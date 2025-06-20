import {
  EnvironmentInfo,
  EnvironmentType,
} from "@fern-fern/fern-cloud-sdk/api/resources/environments";
import { Stack, StackProps } from "aws-cdk-lib";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import { Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { Cluster, ContainerImage, LogDriver } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import {
  ApplicationProtocol,
  HttpCodeTarget,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { PrivateDnsNamespace } from "aws-cdk-lib/aws-servicediscovery";
import * as sns from "aws-cdk-lib/aws-sns";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";

const CONTAINER_NAME = "fern-ai";
const SERVICE_NAME = "fern-ai";

export interface FernAiEnvVariables {
  TURBOPUFFER_API_KEY: string;
  [key: string]: string;
}

export class FernAiDeployStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    version: string,
    environmentType: EnvironmentType,
    environmentInfo: EnvironmentInfo,
    envVariables: FernAiEnvVariables,
    props?: StackProps
  ) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, "vpc", {
      vpcId: environmentInfo.vpcId,
    });

    const farnSg = new SecurityGroup(this, "fern-ai-sg", {
      securityGroupName: `fern-ai-${environmentType.toLowerCase()}`,
      vpc,
      allowAllOutbound: true,
    });
    farnSg.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(443),
      "allow HTTPS traffic from anywhere"
    );
    farnSg.addIngressRule(
      Peer.ipv4(environmentInfo.vpcIpv4Cidr),
      Port.allTcp()
    );

    const cluster = Cluster.fromClusterAttributes(this, "cluster", {
      clusterName: environmentInfo.ecsInfo.clusterName,
      vpc,
      securityGroups: [],
    });

    const cloudMapNamespace =
      PrivateDnsNamespace.fromPrivateDnsNamespaceAttributes(
        this,
        "private-cloudmap",
        {
          namespaceArn: environmentInfo.cloudMapNamespaceInfo.namespaceArn,
          namespaceId: environmentInfo.cloudMapNamespaceInfo.namespaceId,
          namespaceName: environmentInfo.cloudMapNamespaceInfo.namespaceName,
        }
      );

    const logGroup = LogGroup.fromLogGroupName(
      this,
      "log-group",
      environmentInfo.logGroupInfo.logGroupName
    );

    const certificate = Certificate.fromCertificateArn(
      this,
      "ceritificate",
      environmentInfo.route53Info.certificateArn
    );

    const snsTopic = new sns.Topic(this, "fern-ai-sns-topic", {
      topicName: id,
    });
    snsTopic.addSubscription(
      new EmailSubscription("founders@buildwithfern.com")
    );

    const environmentResources = environmentType == EnvironmentType.Prod ? {
      cpu: 2048,
      memoryLimitMiB: 4096,
      desiredCount:  2,
    } : {
      cpu: 1024,
      memoryLimitMiB: 4096,
      desiredCount: 1,
    }

    const fargateService = new ApplicationLoadBalancedFargateService(
      this,
      SERVICE_NAME,
      {
        serviceName: SERVICE_NAME,
        cluster,
        ...environmentResources,
        securityGroups: [farnSg],
        taskImageOptions: {
          image: ContainerImage.fromTarball(`../fern-ai:${version}.tar`),
          containerName: CONTAINER_NAME,
          containerPort: 8080,
          enableLogging: true,
          logDriver: LogDriver.awsLogs({
            logGroup,
            streamPrefix: SERVICE_NAME,
          }),
          environment: {
            ...envVariables,
          },
        },
        assignPublicIp: true,
        publicLoadBalancer: true,
        enableECSManagedTags: true,
        // Remove this before a prod release, but also adding this check just in case
        // This will allow us to run `aws ecs execute-command` and ideally SSH onto the task/container
        enableExecuteCommand: environmentType != EnvironmentType.Prod,
        protocol: ApplicationProtocol.HTTPS,
        certificate,
        domainZone: HostedZone.fromHostedZoneAttributes(this, "zoneId", {
          hostedZoneId: environmentInfo.route53Info.hostedZoneId,
          zoneName: environmentInfo.route53Info.hostedZoneName,
        }),
        domainName: getServiceDomainName(environmentType, environmentInfo),
        cloudMapOptions:
          cloudMapNamespace != null
            ? {
                cloudMapNamespace,
                name: SERVICE_NAME,
              }
            : undefined,
      }
    );

    fargateService.targetGroup.setAttribute(
      "deregistration_delay.timeout_seconds",
      "30"
    );

    fargateService.targetGroup.configureHealthCheck({
      healthyHttpCodes: "200,204",
      path: "/health",
      port: "8080",
    });

    const lbResponseTimeAlarm = new cloudwatch.Alarm(
      this,
      `fern-ai-${environmentType.toLowerCase()}-lb-target-response-time-alarm`,
      {
        alarmName: `${id} Load Balancer Target Response Time Threshold`,
        metric: fargateService.loadBalancer.metrics.targetResponseTime(),
        threshold: 1,
        evaluationPeriods: 5,
      }
    );
    lbResponseTimeAlarm.addAlarmAction(new actions.SnsAction(snsTopic));

    const lbUnhealthyHostCountAlarm = new cloudwatch.Alarm(
      this,
      `fern-ai-${environmentType.toLowerCase()}-lb-unhealthy-host-count-alarm`,
      {
        alarmName: `${id} Load Balancer Unhealthy Host Count Alarm`,
        metric: fargateService.targetGroup.metrics.unhealthyHostCount(),
        threshold: 1,
        evaluationPeriods: 5,
      }
    );
    lbUnhealthyHostCountAlarm.addAlarmAction(new actions.SnsAction(snsTopic));

    const lb500CountAlarm = new cloudwatch.Alarm(
      this,
      `fern-ai-${environmentType.toLowerCase()}-lb-500x-count`,
      {
        alarmName: `${id} Load Balancer 500 Error Alarm`,
        metric: fargateService.loadBalancer.metrics.httpCodeTarget(
          HttpCodeTarget.TARGET_5XX_COUNT
        ),
        threshold: 2,
        evaluationPeriods: 5,
      }
    );
    lb500CountAlarm.addAlarmAction(new actions.SnsAction(snsTopic));
  }
}

function getServiceDomainName(
  environmentType: EnvironmentType,
  environmentInfo: EnvironmentInfo
) {
  if (environmentType == EnvironmentType.Prod) {
    return `fern-ai.${environmentInfo.route53Info.hostedZoneName}`;
  }
  return `fern-ai-${environmentType.toLowerCase()}.${
    environmentInfo.route53Info.hostedZoneName
  }`;
}
