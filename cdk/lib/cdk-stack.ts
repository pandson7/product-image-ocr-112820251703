import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';

export class ProductImageOcrStack112820251703 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for image storage
    const imageBucket = new s3.Bucket(this, 'ImageBucket112820251703', {
      bucketName: `product-images-112820251703`,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // DynamoDB table for OCR results
    const ocrTable = new dynamodb.Table(this, 'OcrTable112820251703', {
      tableName: `ProductOCRResults112820251703`,
      partitionKey: { name: 'imageId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 5,
      writeCapacity: 5,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Enable auto scaling
    ocrTable.autoScaleReadCapacity({
      minCapacity: 1,
      maxCapacity: 10,
    });
    ocrTable.autoScaleWriteCapacity({
      minCapacity: 1,
      maxCapacity: 10,
    });

    // Lambda function for upload handling
    const uploadLambda = new lambda.Function(this, 'UploadLambda112820251703', {
      functionName: `upload-handler-112820251703`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { randomUUID } = require('crypto');

const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const body = JSON.parse(event.body);
    const { fileName, fileType } = body;
    
    const imageId = randomUUID();
    const s3Key = \`images/\${imageId}-\${fileName}\`;
    
    // Create presigned URL
    const command = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: s3Key,
      ContentType: fileType,
    });
    
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    // Create DynamoDB record
    await dynamoClient.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: {
        imageId: { S: imageId },
        s3Key: { S: s3Key },
        processingStatus: { S: 'PENDING' },
        createdAt: { S: new Date().toISOString() },
        fileName: { S: fileName }
      }
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ imageId, uploadUrl })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};`),
      environment: {
        BUCKET_NAME: imageBucket.bucketName,
        TABLE_NAME: ocrTable.tableName,
      },
    });

    // Lambda function for OCR processing
    const ocrLambda = new lambda.Function(this, 'OcrLambda112820251703', {
      functionName: `ocr-processor-112820251703`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      code: lambda.Code.fromInline(`
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

const s3Client = new S3Client({});
const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({});

exports.handler = async (event) => {
  console.log('OCR Lambda started, event:', JSON.stringify(event, null, 2));
  
  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(record.s3.object.key.replace(/\\+/g, ' '));
    const imageId = objectKey.split('/')[1].split('-').slice(0, 5).join('-');
    
    console.log('Processing image:', { bucketName, objectKey, imageId });
    
    try {
      // Update status to PROCESSING
      console.log('Updating status to PROCESSING');
      await dynamoClient.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: { imageId: { S: imageId } },
        UpdateExpression: 'SET processingStatus = :status, updatedAt = :time',
        ExpressionAttributeValues: {
          ':status': { S: 'PROCESSING' },
          ':time': { S: new Date().toISOString() }
        }
      }));
      
      // Get image from S3
      console.log('Getting image from S3');
      const getObjectResponse = await s3Client.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      }));
      
      const imageBytes = await getObjectResponse.Body.transformToByteArray();
      const base64Image = Buffer.from(imageBytes).toString('base64');
      console.log('Image converted to base64, size:', base64Image.length);
      
      // Prepare Bedrock request
      const prompt = \`Analyze this product image and extract the following information in JSON format:
{
  "productName": "string",
  "brand": "string", 
  "category": "string",
  "price": "string",
  "dimensions": "string",
  "weight": "string",
  "description": "string",
  "additionalDetails": {}
}

Please provide only the JSON response without any additional text.\`;

      const requestBody = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [{
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: base64Image
            }
          }, {
            type: "text",
            text: prompt
          }]
        }]
      };
      
      console.log('Calling Bedrock');
      // Call Bedrock
      const response = await bedrockClient.send(new InvokeModelCommand({
        modelId: \`arn:aws:bedrock:us-east-1:\${process.env.AWS_ACCOUNT_ID}:inference-profile/global.anthropic.claude-sonnet-4-20250514-v1:0\`,
        contentType: 'application/json',
        body: JSON.stringify(requestBody)
      }));
      
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      let extractedData = responseBody.content[0].text;
      console.log('Bedrock response:', extractedData);
      
      // Extract JSON from markdown if present
      const jsonMatch = extractedData.match(/\`\`\`json\\n([\\s\\S]*?)\\n\`\`\`/) || extractedData.match(/\`\`\`\\n([\\s\\S]*?)\\n\`\`\`/) || extractedData.match(/({[\\s\\S]*})/);
      if (jsonMatch) {
        extractedData = jsonMatch[1];
      }
      
      const parsedData = JSON.parse(extractedData);
      console.log('Parsed data:', parsedData);
      
      // Update DynamoDB with results
      console.log('Updating DynamoDB with results');
      await dynamoClient.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: { imageId: { S: imageId } },
        UpdateExpression: 'SET processingStatus = :status, extractedData = :data, updatedAt = :time',
        ExpressionAttributeValues: {
          ':status': { S: 'COMPLETED' },
          ':data': { S: JSON.stringify(parsedData) },
          ':time': { S: new Date().toISOString() }
        }
      }));
      
      console.log('Processing completed successfully');
      
    } catch (error) {
      console.error('OCR processing error:', error);
      
      // Update status to FAILED
      await dynamoClient.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: { imageId: { S: imageId } },
        UpdateExpression: 'SET processingStatus = :status, errorMessage = :error, updatedAt = :time',
        ExpressionAttributeValues: {
          ':status': { S: 'FAILED' },
          ':error': { S: error.message },
          ':time': { S: new Date().toISOString() }
        }
      }));
    }
  }
};`),
      environment: {
        TABLE_NAME: ocrTable.tableName,
        AWS_ACCOUNT_ID: cdk.Aws.ACCOUNT_ID,
      },
    });

    // Lambda function for results retrieval
    const resultsLambda = new lambda.Function(this, 'ResultsLambda112820251703', {
      functionName: `results-handler-112820251703`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');

const dynamoClient = new DynamoDBClient({});

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const imageId = event.pathParameters.id;
    
    const response = await dynamoClient.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: { imageId: { S: imageId } }
    }));
    
    if (!response.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Image not found' })
      };
    }
    
    const item = {
      imageId: response.Item.imageId.S,
      processingStatus: response.Item.processingStatus.S,
      createdAt: response.Item.createdAt.S,
      updatedAt: response.Item.updatedAt?.S,
      fileName: response.Item.fileName?.S,
      extractedData: response.Item.extractedData?.S ? JSON.parse(response.Item.extractedData.S) : null,
      errorMessage: response.Item.errorMessage?.S
    };
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(item)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};`),
      environment: {
        TABLE_NAME: ocrTable.tableName,
      },
    });

    // Grant permissions
    imageBucket.grantReadWrite(uploadLambda);
    imageBucket.grantRead(ocrLambda);
    ocrTable.grantReadWriteData(uploadLambda);
    ocrTable.grantReadWriteData(ocrLambda);
    ocrTable.grantReadData(resultsLambda);

    // Grant Bedrock permissions to OCR Lambda
    ocrLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:us-east-1:${cdk.Aws.ACCOUNT_ID}:inference-profile/global.anthropic.claude-sonnet-4-20250514-v1:0`,
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0'
      ]
    }));

    // S3 event notification
    imageBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(ocrLambda));

    // API Gateway
    const api = new apigateway.RestApi(this, 'ProductOcrApi112820251703', {
      restApiName: 'ProductOCRAPI112820251703',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      },
    });

    // API endpoints
    const uploadIntegration = new apigateway.LambdaIntegration(uploadLambda);
    api.root.addResource('upload').addMethod('POST', uploadIntegration);

    const resultsResource = api.root.addResource('results');
    const resultsIntegration = new apigateway.LambdaIntegration(resultsLambda);
    resultsResource.addResource('{id}').addMethod('GET', resultsIntegration);

    // Output API Gateway URL
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });
  }
}
