import { type EnvironmentInfo, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api/resources/environments";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps, Tags } from "aws-cdk-lib";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import { Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { Cluster, ContainerImage, LogDriver } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import { ApplicationProtocol, HttpCodeTarget } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as sns from "aws-cdk-lib/aws-sns";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import type { Construct } from "constructs";
import * as path from "path";

const SERVICE_NAME = "fai-chat";

export interface FaiChatEcsStackProps extends StackProps {
    version: string;
    environmentType: EnvironmentType;
    environmentInfo: EnvironmentInfo;
    isPreview: boolean;
    prNumber?: string;
}

export class FaiChatEcsStack extends Stack {
    constructor(scope: Construct, id: string, props: FaiChatEcsStackProps) {
        super(scope, id, props);

        const { environmentType, environmentInfo, isPreview, prNumber } = props;
        const isProd = environmentType === EnvironmentType.Prod;

        const serviceName = isPreview
            ? `${SERVICE_NAME}-preview-${prNumber}`
            : `${SERVICE_NAME}-${environmentType.toLowerCase()}`;

        const logGroupName = `/ecs/${serviceName}`;
        const logGroup = new LogGroup(this, "log-group", {
            logGroupName,
            retention: isProd ? RetentionDays.ONE_YEAR : RetentionDays.ONE_MONTH,
            removalPolicy: isPreview ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
        });

        Tags.of(this).add("Environment", environmentType.toLowerCase());
        if (!isProd) {
            Tags.of(this).add("VantaNonProd", "true");
        }

        const vpc = Vpc.fromLookup(this, "vpc", {
            vpcId: environmentInfo.vpcId
        });

        const securityGroup = new SecurityGroup(this, "sg", {
            securityGroupName: serviceName,
            vpc,
            allowAllOutbound: true
        });
        securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "Allow HTTPS traffic");
        securityGroup.addIngressRule(Peer.ipv4(environmentInfo.vpcIpv4Cidr), Port.allTcp());

        const cluster = Cluster.fromClusterAttributes(this, "cluster", {
            clusterName: environmentInfo.ecsInfo.clusterName,
            vpc,
            securityGroups: []
        });

        const certificate = Certificate.fromCertificateArn(
            this,
            "certificate",
            environmentInfo.route53Info.certificateArn
        );

        const hostedZone = HostedZone.fromHostedZoneAttributes(this, "zone", {
            hostedZoneId: environmentInfo.route53Info.hostedZoneId,
            zoneName: environmentInfo.route53Info.hostedZoneName
        });

        // Resource sizing based on environment
        const resourceConfig = isPreview
            ? { cpu: 512, memoryLimitMiB: 1024, desiredCount: 1, minCapacity: 1, maxCapacity: 2 }
            : isProd
              ? { cpu: 1024, memoryLimitMiB: 2048, desiredCount: 2, minCapacity: 2, maxCapacity: 10 }
              : { cpu: 512, memoryLimitMiB: 1024, desiredCount: 1, minCapacity: 1, maxCapacity: 4 };

        const fargateService = new ApplicationLoadBalancedFargateService(this, "service", {
            serviceName,
            cluster,
            cpu: resourceConfig.cpu,
            memoryLimitMiB: resourceConfig.memoryLimitMiB,
            desiredCount: resourceConfig.desiredCount,
            securityGroups: [securityGroup],
            taskImageOptions: {
                image: ContainerImage.fromAsset(path.join(__dirname, "../../.."), {
                    file: "servers/fai-chat/Dockerfile.ecs",
                    exclude: ["**/cdk.out/**"]
                }),
                containerName: SERVICE_NAME,
                containerPort: 8080,
                enableLogging: true,
                logDriver: LogDriver.awsLogs({
                    logGroup,
                    streamPrefix: SERVICE_NAME
                }),
                environment: {
                    ENVIRONMENT_TYPE: environmentType,
                    ANTHROPIC_API_KEY: getEnvOrThrow("ANTHROPIC_API_KEY"),
                    OPENAI_API_KEY: getEnvOrThrow("OPENAI_API_KEY"),
                    COHERE_API_KEY: getEnvOrThrow("COHERE_API_KEY"),
                    TURBOPUFFER_API_KEY: getEnvOrThrow("TURBOPUFFER_API_KEY"),
                    FERN_TOKEN: getEnvOrThrow("FERN_TOKEN"),
                    POSTHOG_API_KEY: getEnvOrThrow("POSTHOG_API_KEY"),
                    AWS_ACCESS_KEY_ID: getEnvOrThrow("AWS_ACCESS_KEY_ID"),
                    AWS_SECRET_ACCESS_KEY: getEnvOrThrow("AWS_SECRET_ACCESS_KEY"),
                    FDR_LAMBDA_ORIGIN: getFdrLambdaOrigin(environmentType),
                    FAI_ORIGIN: getFaiOrigin(environmentType)
                }
            },
            assignPublicIp: true,
            publicLoadBalancer: true,
            enableECSManagedTags: true,
            enableExecuteCommand: !isProd,
            protocol: ApplicationProtocol.HTTPS,
            certificate,
            circuitBreaker: { rollback: true }
        });

        // Grant Bedrock permissions for LLM inference
        fargateService.taskDefinition.taskRole.addToPrincipalPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
                resources: ["*"]
            })
        );

        // ALB configuration for streaming workloads
        // Idle timeout must be >= longest expected stream duration (15 min)
        fargateService.loadBalancer.setAttribute("idle_timeout.timeout_seconds", "900");

        // Deregistration delay - time for in-flight streams to complete during deployment
        fargateService.targetGroup.setAttribute("deregistration_delay.timeout_seconds", "300");

        // Slow start - gradually increase traffic to new tasks
        fargateService.targetGroup.setAttribute("slow_start.duration_seconds", "120");

        // Health check configuration
        fargateService.targetGroup.configureHealthCheck({
            path: "/health/ready",
            healthyHttpCodes: "200",
            port: "8080",
            interval: Duration.seconds(30),
            timeout: Duration.seconds(10),
            healthyThresholdCount: 2,
            unhealthyThresholdCount: 5
        });

        // Auto-scaling configuration
        const scaling = fargateService.service.autoScaleTaskCount({
            minCapacity: resourceConfig.minCapacity,
            maxCapacity: resourceConfig.maxCapacity
        });

        // Request-based scaling - better for streaming workloads than CPU-based
        scaling.scaleOnRequestCount("RequestScaling", {
            targetGroup: fargateService.targetGroup,
            requestsPerTarget: isProd ? 10 : 20,
            scaleInCooldown: Duration.minutes(5),
            scaleOutCooldown: Duration.seconds(60)
        });

        // CPU utilization as safety net
        scaling.scaleOnCpuUtilization("CpuScaling", {
            targetUtilizationPercent: 70,
            scaleInCooldown: Duration.minutes(5),
            scaleOutCooldown: Duration.seconds(60)
        });

        // Memory utilization for streaming buffer protection
        scaling.scaleOnMemoryUtilization("MemoryScaling", {
            targetUtilizationPercent: 80,
            scaleInCooldown: Duration.minutes(5),
            scaleOutCooldown: Duration.seconds(60)
        });

        // DNS and domain setup (only for non-preview)
        if (!isPreview) {
            const domainName = getDomainName(SERVICE_NAME, environmentType, environmentInfo);

            new ARecord(this, "dns-record", {
                zone: hostedZone,
                target: RecordTarget.fromAlias(new targets.LoadBalancerTarget(fargateService.loadBalancer)),
                recordName: domainName
            });

            new CfnOutput(this, "ServiceUrl", {
                value: `https://${domainName}`,
                description: "Service URL"
            });
        }

        // CloudWatch alarms (only for non-preview)
        if (!isPreview) {
            const snsTopic = new sns.Topic(this, "alerts-topic", {
                topicName: `${serviceName}-alerts`
            });
            snsTopic.addSubscription(new EmailSubscription("alerts@buildwithfern.com"));

            // Response time alarm (critical for TTFT)
            const responseTimeAlarm = new cloudwatch.Alarm(this, "response-time-alarm", {
                alarmName: `${serviceName}-response-time`,
                metric: fargateService.loadBalancer.metrics.targetResponseTime({
                    statistic: "p95",
                    period: Duration.minutes(5)
                }),
                threshold: 30,
                evaluationPeriods: 3,
                alarmDescription: "High p95 response time - may indicate LLM provider issues"
            });
            responseTimeAlarm.addAlarmAction(new actions.SnsAction(snsTopic));

            // Unhealthy host count alarm
            const unhealthyHostsAlarm = new cloudwatch.Alarm(this, "unhealthy-hosts-alarm", {
                alarmName: `${serviceName}-unhealthy-hosts`,
                metric: fargateService.targetGroup.metrics.unhealthyHostCount(),
                threshold: 1,
                evaluationPeriods: 2,
                alarmDescription: "ECS task failing health checks"
            });
            unhealthyHostsAlarm.addAlarmAction(new actions.SnsAction(snsTopic));

            // 5XX errors alarm
            const errorAlarm = new cloudwatch.Alarm(this, "5xx-errors-alarm", {
                alarmName: `${serviceName}-5xx-errors`,
                metric: fargateService.loadBalancer.metrics.httpCodeTarget(HttpCodeTarget.TARGET_5XX_COUNT, {
                    period: Duration.minutes(5)
                }),
                threshold: 10,
                evaluationPeriods: 2,
                alarmDescription: "Elevated 5XX error rate"
            });
            errorAlarm.addAlarmAction(new actions.SnsAction(snsTopic));
        }

        // Outputs
        new CfnOutput(this, "LoadBalancerDns", {
            value: fargateService.loadBalancer.loadBalancerDnsName,
            description: "Load Balancer DNS"
        });

        if (isPreview) {
            new CfnOutput(this, "PreviewUrl", {
                value: `https://${fargateService.loadBalancer.loadBalancerDnsName}`,
                description: "Preview URL for this PR"
            });
        }
    }
}

function getDomainName(
    serviceName: string,
    environmentType: EnvironmentType,
    environmentInfo: EnvironmentInfo
): string {
    if (environmentType === EnvironmentType.Prod) {
        return `${serviceName}.${environmentInfo.route53Info.hostedZoneName}`;
    }
    return `${serviceName}-${environmentType.toLowerCase()}.${environmentInfo.route53Info.hostedZoneName}`;
}

function getEnvOrThrow(envVarName: string): string {
    const val = process.env[envVarName];
    if (val != null) {
        return val;
    }
    throw new Error(`Environment variable ${envVarName} is not defined`);
}

function getFdrLambdaOrigin(environmentType: EnvironmentType): string {
    switch (environmentType) {
        case EnvironmentType.Dev:
        case EnvironmentType.Dev2:
            return "https://registry-v2-dev2.buildwithfern.com";
        case EnvironmentType.Prod:
            return "https://registry-v2.buildwithfern.com";
    }
}

function getFaiOrigin(environmentType: EnvironmentType): string {
    switch (environmentType) {
        case EnvironmentType.Dev:
        case EnvironmentType.Dev2:
            return "https://fai-dev2.buildwithfern.com";
        case EnvironmentType.Prod:
            return "https://fai.buildwithfern.com";
    }
}
