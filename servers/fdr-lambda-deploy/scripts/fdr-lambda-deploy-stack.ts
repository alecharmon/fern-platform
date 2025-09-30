import { CfnOutput, Duration, Stack, StackProps } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import * as path from "path";

import {
  EnvironmentInfo,
  EnvironmentType,
} from "@fern-fern/fern-cloud-sdk/api";

export class FdrLambdaDeployStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    version: string,
    environmentType: EnvironmentType,
    environmentInfo: EnvironmentInfo,
    props?: StackProps
  ) {
    super(scope, id, props);

    const logGroup = LogGroup.fromLogGroupName(
      this,
      "log-group",
      environmentInfo.logGroupInfo.logGroupName
    );

    const certificate = Certificate.fromCertificateArn(
      this,
      "certificate",
      environmentInfo.route53Info.certificateArn
    );

    const hostedZone = HostedZone.fromHostedZoneAttributes(this, "zoneId", {
      hostedZoneId: environmentInfo.route53Info.hostedZoneId,
      zoneName: environmentInfo.route53Info.hostedZoneName,
    });

    // Create Lambda function
    const lambdaFunction = new lambda.Function(this, "fdr-lambda-function", {
      functionName: `fdr-lambda-${environmentType.toLowerCase()}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../fdr-lambda/dist")
      ),
      timeout: Duration.seconds(30),
      memorySize: 512,
      logGroup,
      environment: {
        NODE_ENV: "production",
        ENVIRONMENT_TYPE: environmentType,
      },
    });

    // Create API Gateway with custom domain
    const api = new apigateway.RestApi(this, "fdr-lambda-api", {
      restApiName: `fdr-lambda-${environmentType.toLowerCase()}`,
      description: `FDR Lambda API for ${environmentType}`,
      deployOptions: {
        stageName: environmentType.toLowerCase(),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    });

    // Create custom domain name for API Gateway
    const customDomain = new apigateway.DomainName(this, "fdr-lambda-domain", {
      domainName: getLambdaDomainName(environmentType, environmentInfo),
      certificate,
    });

    // Map the custom domain to the API Gateway
    new apigateway.BasePathMapping(this, "fdr-lambda-base-path-mapping", {
      domainName: customDomain,
      restApi: api,
      stage: api.deploymentStage,
    });

    // Add Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(lambdaFunction);

    // Add proxy resource
    api.root.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true,
    });

    // Add health endpoint
    const health = api.root.addResource("health");
    health.addMethod("GET", lambdaIntegration);

    // Create Route53 record for custom domain
    new ARecord(this, "fdr-lambda-domain-record", {
      zone: hostedZone,
      target: RecordTarget.fromAlias(
        new targets.ApiGatewayDomain(customDomain)
      ),
      recordName: getLambdaDomainName(environmentType, environmentInfo),
    });

    // Output the API URL
    new CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "API Gateway URL",
    });

    new CfnOutput(this, "CustomDomainUrl", {
      value: `https://${getLambdaDomainName(environmentType, environmentInfo)}`,
      description: "Custom Domain URL",
    });

    new CfnOutput(this, "LambdaFunctionName", {
      value: lambdaFunction.functionName,
      description: "Lambda Function Name",
    });
  }
}

function getLambdaDomainName(
  environmentType: EnvironmentType,
  environmentInfo: EnvironmentInfo
) {
  if (environmentType === EnvironmentType.Prod) {
    return "registry-v2" + "." + environmentInfo.route53Info.hostedZoneName;
  }
  return (
    "registry-v2" +
    "-" +
    environmentType.toLowerCase() +
    "." +
    environmentInfo.route53Info.hostedZoneName
  );
}
