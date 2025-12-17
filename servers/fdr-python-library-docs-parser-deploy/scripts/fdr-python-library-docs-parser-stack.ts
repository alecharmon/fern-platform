import { type EnvironmentInfo, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import * as path from "path";

export class FdrPythonLibraryDocsParserStack extends Stack {
    constructor(
        scope: Construct,
        id: string,
        version: string,
        environmentType: EnvironmentType,
        environmentInfo: EnvironmentInfo,
        props?: StackProps
    ) {
        super(scope, id, props);

        const lambdaName = "fdr-python-library-docs-parser";

        const logGroup = new LogGroup(this, "log-group", {
            logGroupName: `/aws/lambda/${lambdaName}-${environmentType.toLowerCase()}`,
            retention: RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY
        });

        // Import existing shared VPC
        const vpc = ec2.Vpc.fromLookup(this, "vpc", {
            vpcId: environmentInfo.vpcId
        });

        const lambdaSecurityGroup = new ec2.SecurityGroup(this, "lambda-security-group", {
            vpc,
            description: `Security group for ${lambdaName} Lambda function`,
            allowAllOutbound: true
        });

        const functionName = `${lambdaName}-${environmentType.toLowerCase()}`;

        // S3 bucket for library docs (uses existing fdr bucket)
        const s3BucketName = getS3BucketName(environmentType);

        const lambdaFunction = new lambda.DockerImageFunction(this, `${lambdaName}-lambda-function`, {
            functionName,
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, "../../fdr-python-library-docs-parser")),
            timeout: Duration.minutes(10),
            memorySize: 1024,
            logGroup,
            vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            },
            securityGroups: [lambdaSecurityGroup],
            environment: {
                ENVIRONMENT_TYPE: environmentType,
                LIBRARY_DOCS_S3_BUCKET: s3BucketName
            }
        });

        // Grant S3 PutObject permission for IR uploads
        lambdaFunction.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ["s3:PutObject"],
                resources: [`arn:aws:s3:::${s3BucketName}/library-docs-ir/*`]
            })
        );

        new CfnOutput(this, "LambdaFunctionName", {
            value: lambdaFunction.functionName,
            description: "Lambda Function Name"
        });

        new CfnOutput(this, "LambdaFunctionArn", {
            value: lambdaFunction.functionArn,
            description: "Lambda Function ARN"
        });
    }
}

function getS3BucketName(environmentType: EnvironmentType): string {
    switch (environmentType) {
        case EnvironmentType.Dev:
        case EnvironmentType.Dev2:
            return "fdr-dev2-library-docs-files";
        case EnvironmentType.Prod:
            return "fdr-prod-library-docs-files";
        default:
            return "fdr-dev2-library-docs-files";
    }
}
