# Product Image OCR Processing System - Architecture Diagrams

This folder contains AWS architecture diagrams for the Product Image OCR Processing System, generated based on the technical design specifications.

## Generated Diagrams

### 1. Main Architecture (`main_architecture.png`)
- **Purpose**: High-level system overview showing all major components and their relationships
- **Components**: React frontend, API Gateway, Lambda functions, S3 storage, Bedrock AI, DynamoDB, CloudWatch monitoring
- **Flow**: User interaction through React app → API Gateway → Lambda processing → AI analysis → Data storage

### 2. Data Flow (`data_flow.png`)
- **Purpose**: Detailed step-by-step data flow through the system
- **Shows**: 17-step process from image upload to results display
- **Key Steps**: 
  - Image upload via presigned URLs
  - S3 event-triggered OCR processing
  - Bedrock AI analysis
  - DynamoDB storage and retrieval

### 3. Security & IAM (`security_iam.png`)
- **Purpose**: Security architecture and IAM role assignments
- **Components**: IAM roles for each Lambda function with specific permissions
- **Security Features**: 
  - Least privilege access
  - KMS encryption for S3 and DynamoDB
  - CloudWatch logging permissions

### 4. Monitoring & Logging (`monitoring_logging.png`)
- **Purpose**: Observability and monitoring architecture
- **Components**: CloudWatch Logs, Metrics, and Alarms
- **Metrics Tracked**:
  - Lambda: Duration, Errors, Invocations
  - API Gateway: Request Count, Latency, Error Rates
  - S3: Object Count, Storage Size
  - DynamoDB: Read/Write Capacity, Throttles

### 5. Deployment Architecture (`deployment_architecture.png`)
- **Purpose**: Development and deployment workflow
- **Components**: Local development environment, AWS CDK for IaC, AWS services
- **Deployment**: CDK TypeScript stack for infrastructure provisioning

## Architecture Highlights

### Serverless Design
- **No servers to manage**: All compute handled by Lambda functions
- **Auto-scaling**: Automatic scaling based on demand
- **Cost-effective**: Pay only for actual usage

### Event-Driven Processing
- **S3 Events**: Automatic OCR processing triggered by image uploads
- **Asynchronous**: Non-blocking processing for better user experience
- **Reliable**: Built-in retry mechanisms and error handling

### AI-Powered OCR
- **Amazon Bedrock**: Claude 3 Sonnet for intelligent image analysis
- **Structured Output**: JSON-formatted product specifications
- **High Accuracy**: Advanced AI model for text and product recognition

### Data Storage
- **DynamoDB**: NoSQL database for extracted product data
- **S3**: Scalable object storage for images
- **Encryption**: Data encrypted at rest using KMS

### Development Workflow
- **Local Development**: React dev server for frontend development
- **Infrastructure as Code**: AWS CDK for reproducible deployments
- **No Authentication**: Simplified prototype without user management

## File Locations

All diagrams are stored in:
```
/home/pandson/echo-architect-artifacts/product-image-ocr-112820251703/generated-diagrams/generated-diagrams/
```

## Technical Specifications

- **Frontend**: React 18+ with drag-and-drop file upload
- **API**: REST API via API Gateway with CORS enabled
- **Compute**: Node.js 18.x Lambda functions
- **Storage**: S3 bucket with event notifications
- **Database**: DynamoDB with on-demand pricing
- **AI**: Amazon Bedrock Claude 3 Sonnet
- **Monitoring**: CloudWatch Logs, Metrics, and Alarms
- **Security**: IAM roles with least privilege access
- **Deployment**: AWS CDK TypeScript stack

## Next Steps

1. Deploy the CDK stack to provision AWS resources
2. Configure the React frontend with API Gateway endpoints
3. Test the complete workflow with sample images
4. Monitor performance and optimize as needed
