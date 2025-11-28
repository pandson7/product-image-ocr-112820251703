# Design Document

## Introduction

This document outlines the technical architecture for a product image OCR processing system that leverages AWS services to automatically extract product specifications from uploaded images. The system uses a serverless architecture with React frontend, S3 storage, Lambda processing, Bedrock AI, and DynamoDB storage.

## System Architecture

### High-Level Architecture

The system follows a serverless event-driven architecture:

1. **Frontend Layer**: React application for user interaction
2. **Storage Layer**: Amazon S3 for image storage
3. **Processing Layer**: AWS Lambda for OCR orchestration
4. **AI Layer**: Amazon Bedrock with Claude model for image analysis
5. **Data Layer**: Amazon DynamoDB for extracted data storage
6. **API Layer**: API Gateway for frontend-backend communication

### Component Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │───▶│   API Gateway   │───▶│   Lambda        │
│   (Frontend)    │    │                 │    │   (Upload)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   DynamoDB      │◀───│   Lambda        │◀───│   S3 Bucket     │
│   (Data Store)  │    │   (OCR Process) │    │   (Images)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       │
                       ┌─────────────────┐              │
                       │   Bedrock       │              │
                       │   (Claude AI)   │              │
                       └─────────────────┘              │
                                                        │
                       ┌─────────────────┐              │
                       │   Lambda        │◀─────────────┘
                       │   (Get Results) │
                       └─────────────────┘
```

## Technical Components

### 1. Frontend (React Application)

**Technology Stack:**
- React 18+ with functional components and hooks
- Axios for API communication
- File upload with drag-and-drop support
- Real-time status updates

**Key Features:**
- Image upload interface with drag-and-drop
- Progress indicators and status messages
- Display extracted product specifications
- Error handling and user feedback

**Local Development:**
- Runs on localhost with development server
- No CDN or CloudFront distribution required
- Direct API calls to API Gateway endpoints

### 2. API Gateway

**Configuration:**
- REST API with CORS enabled for local development
- Endpoints for image upload and data retrieval
- Integration with Lambda functions
- Request/response transformation as needed

**Endpoints:**
- `POST /upload` - Initiate image upload to S3
- `GET /results/{id}` - Retrieve extracted product data
- `GET /status/{id}` - Check processing status

### 3. S3 Storage

**Bucket Configuration:**
- Single bucket for image storage
- Event notifications to trigger Lambda processing
- Appropriate lifecycle policies for cost optimization
- Public read access not required (presigned URLs for uploads)

**Event Triggers:**
- S3 ObjectCreated event triggers OCR processing Lambda
- Automatic cleanup of processed images after retention period

### 4. Lambda Functions

#### Upload Handler Lambda
- **Runtime**: Node.js 18.x
- **Purpose**: Generate presigned URLs for S3 uploads
- **Triggers**: API Gateway POST /upload
- **Permissions**: S3 PutObject, DynamoDB PutItem

#### OCR Processing Lambda
- **Runtime**: Node.js 18.x
- **Purpose**: Process uploaded images using Bedrock
- **Triggers**: S3 ObjectCreated events
- **Permissions**: S3 GetObject, Bedrock InvokeModel, DynamoDB PutItem/UpdateItem
- **Timeout**: 5 minutes (for large image processing)
- **Memory**: 1024 MB

#### Results Retrieval Lambda
- **Runtime**: Node.js 18.x
- **Purpose**: Fetch extracted data from DynamoDB
- **Triggers**: API Gateway GET requests
- **Permissions**: DynamoDB GetItem, Query

### 5. Amazon Bedrock Integration

**Model Configuration:**
- **Model**: Claude 3 Sonnet or Claude 3.5 Sonnet
- **Region**: us-east-1 (or region with Bedrock availability)
- **Input**: Base64 encoded image + structured prompt
- **Output**: JSON formatted product specifications

**Prompt Engineering:**
```
Analyze this product image and extract the following information in JSON format:
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
```

### 6. DynamoDB Data Store

**Table Design:**
- **Table Name**: ProductOCRResults
- **Partition Key**: imageId (String)
- **Attributes**:
  - imageId: Unique identifier for the image
  - s3Key: S3 object key for the image
  - extractedData: JSON object with product specifications
  - processingStatus: PENDING | PROCESSING | COMPLETED | FAILED
  - createdAt: ISO timestamp
  - updatedAt: ISO timestamp
  - errorMessage: Error details if processing failed

**Indexes:**
- GSI on processingStatus for querying by status
- TTL attribute for automatic cleanup of old records

## Security Considerations

### IAM Roles and Policies

**Lambda Execution Roles:**
- Separate roles for each Lambda function with minimal required permissions
- S3 access limited to specific bucket and operations
- DynamoDB access limited to required tables and operations
- Bedrock access for model invocation only

**API Gateway Security:**
- CORS configuration for local development
- Request validation and rate limiting
- No authentication required for prototype (as specified)

### Data Protection
- Images stored in S3 with server-side encryption
- DynamoDB encryption at rest enabled
- No sensitive data logging in CloudWatch

## Deployment Strategy

### Infrastructure as Code
- **Tool**: AWS CDK (TypeScript)
- **Stacks**: Single stack deployment for simplicity
- **Resources**: All AWS resources defined in CDK
- **No CI/CD**: Direct deployment using CDK commands

### Deployment Steps
1. Deploy CDK stack to create AWS resources
2. Build and start React frontend locally
3. Configure API endpoints in frontend
4. Test end-to-end functionality

## Performance Considerations

### Scalability
- Lambda functions auto-scale based on demand
- DynamoDB on-demand pricing for variable workloads
- S3 handles unlimited storage requirements

### Optimization
- Lambda cold start mitigation through appropriate memory allocation
- DynamoDB query optimization using appropriate keys
- Image processing timeout handling for large files

## Monitoring and Logging

### CloudWatch Integration
- Lambda function logs and metrics
- API Gateway access logs and metrics
- DynamoDB performance metrics
- Custom metrics for processing success/failure rates

### Error Handling
- Comprehensive error logging in all Lambda functions
- User-friendly error messages in frontend
- Retry logic for transient failures
- Dead letter queues for failed processing

## Testing Strategy

### End-to-End Testing Requirements
- Use sample images from ~/ea_sample_docs/ocr folder
- Test complete workflow: upload → processing → storage → retrieval
- Validate frontend functionality including drag-and-drop
- Confirm API integration without CORS issues
- Verify data accuracy in DynamoDB and UI display

### Test Scenarios
1. Successful image upload and processing
2. Error handling for unsupported file formats
3. Large image processing within timeout limits
4. Concurrent upload handling
5. Frontend responsiveness and user experience
