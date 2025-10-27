import type { EnvironmentInfo, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api";
import * as cdk from "aws-cdk-lib";
import { RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { BlockPublicAccess, Bucket, HttpMethods } from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

interface DashboardStackOptions {
    versioned?: boolean;
}

export class DashboardDeployStack extends Stack {
    constructor(
        scope: Construct,
        id: string,
        environmentType: EnvironmentType,
        environmentInfo: EnvironmentInfo,
        options?: DashboardStackOptions,
        props?: StackProps
    ) {
        super(scope, id, props);

        // Create S3 bucket for onboarding assets
        const onboardingAssetsBucket = new Bucket(this, "dashboard-onboarding-assets", {
            bucketName: `dashboard-${environmentType.toLowerCase()}-onboarding-assets`,
            removalPolicy: RemovalPolicy.RETAIN,
            cors: [
                {
                    allowedMethods: [HttpMethods.GET, HttpMethods.POST, HttpMethods.PUT],
                    allowedOrigins: ["*"],
                    allowedHeaders: ["*"]
                }
            ],
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            versioned: options?.versioned ?? true
        });

        // Create IAM user for accessing the bucket (e.g., from dashboard application)
        const dashboardUser = new iam.User(this, "DashboardUser", {
            userName: `dashboard-${environmentType.toLowerCase()}-user`
        });

        // Grant read/write permissions to the bucket
        onboardingAssetsBucket.grantReadWrite(dashboardUser);

        // Output the bucket name and ARN for reference
        new cdk.CfnOutput(this, "OnboardingAssetsBucketName", {
            value: onboardingAssetsBucket.bucketName,
            description: "Name of the S3 bucket for dashboard onboarding assets"
        });

        new cdk.CfnOutput(this, "OnboardingAssetsBucketArn", {
            value: onboardingAssetsBucket.bucketArn,
            description: "ARN of the S3 bucket for dashboard onboarding assets"
        });

        new cdk.CfnOutput(this, "DashboardUserArn", {
            value: dashboardUser.userArn,
            description: "ARN of the IAM user for dashboard bucket access"
        });
    }
}
