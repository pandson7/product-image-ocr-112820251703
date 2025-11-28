#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductImageOcrStack112820251703 } from '../lib/cdk-stack';

const app = new cdk.App();
new ProductImageOcrStack112820251703(app, 'ProductImageOcrStack112820251703', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});
