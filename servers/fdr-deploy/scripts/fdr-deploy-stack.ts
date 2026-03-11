import { type EnvironmentInfo, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api";
import {
    CfnOutput,
    Duration,
    type Environment,
    RemovalPolicy,
    SecretValue,
    Stack,
    type StackProps,
    Token
} from "aws-cdk-lib";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { Alarm } from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import { type IVpc, Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { Cluster, ContainerImage, LogDriver, type Volume } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import { CfnReplicationGroup, CfnSubnetGroup } from "aws-cdk-lib/aws-elasticache";
import { ApplicationProtocol, HttpCodeElb } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as events from "aws-cdk-lib/aws-events";
import * as eventTargets from "aws-cdk-lib/aws-events-targets";
import {
    ArnPrincipal,
    Effect,
    PolicyDocument,
    PolicyStatement,
    Role,
    ServicePrincipal,
    User
} from "aws-cdk-lib/aws-iam";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { CfnPipe } from "aws-cdk-lib/aws-pipes";
import * as route53 from "aws-cdk-lib/aws-route53";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import { LoadBalancerTarget } from "aws-cdk-lib/aws-route53-targets";
import { BlockPublicAccess, Bucket, HttpMethods } from "aws-cdk-lib/aws-s3";
import { PrivateDnsNamespace } from "aws-cdk-lib/aws-servicediscovery";
import * as sns from "aws-cdk-lib/aws-sns";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import * as path from "path";

const CONTAINER_NAME = "fern-definition-registry";
const SERVICE_NAME = "fdr";

interface ElastiCacheProps {
    readonly cacheName: string;
    readonly IVpc: IVpc;
    readonly numCacheShards: number;
    readonly numCacheReplicasPerShard: number | undefined;
    readonly clusterMode: "enabled" | "disabled";
    readonly cacheNodeType: string;
    readonly envType: EnvironmentType;
    readonly env?: Environment;
    readonly ingressSecurityGroup?: SecurityGroup;
}

interface FdrStackOptions {
    redis: boolean;
    redisClusteringModeEnabled: boolean;
    maxTaskCount: number;
    desiredTaskCount: number;
    cpu: number;
    memory: number;
    cacheName: string;
    cacheNodeType: string;
}

export class FdrDeployStack extends Stack {
    constructor(
        scope: Construct,
        id: string,
        version: string,
        environmentType: EnvironmentType,
        environmentInfo: EnvironmentInfo,
        options: FdrStackOptions,
        props?: StackProps
    ) {
        super(scope, id, props);

        const vpc = Vpc.fromLookup(this, "vpc", {
            vpcId: environmentInfo.vpcId
        });

        const efsSg = SecurityGroup.fromLookupByName(this, "efs-sg", environmentInfo.efsInfo.securityGroupName, vpc);

        const fdrSg = new SecurityGroup(this, "fdr-sg", {
            securityGroupName: `fdr-${environmentType.toLowerCase()}`,
            vpc,
            allowAllOutbound: true
        });
        fdrSg.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "allow HTTPS traffic from anywhere");
        fdrSg.addIngressRule(Peer.ipv4(environmentInfo.vpcIpv4Cidr), Port.allTcp());

        const cluster = Cluster.fromClusterAttributes(this, "cluster", {
            clusterName: environmentInfo.ecsInfo.clusterName,
            vpc,
            securityGroups: []
        });

        const logGroup = LogGroup.fromLogGroupName(this, "log-group", environmentInfo.logGroupInfo.logGroupName);

        const certificate = Certificate.fromCertificateArn(
            this,
            "ceritificate",
            environmentInfo.route53Info.certificateArn
        );

        const hostedZone = HostedZone.fromHostedZoneAttributes(this, "zoneId", {
            hostedZoneId: environmentInfo.route53Info.hostedZoneId,
            zoneName: environmentInfo.route53Info.hostedZoneName
        });

        const snsTopic = new sns.Topic(this, "fdr-sns-topic", {
            topicName: id
        });
        snsTopic.addSubscription(new EmailSubscription("support@buildwithfern.com"));

        const privateApiDefinitionSourceBucket = new Bucket(this, "fdr-api-definition-source-files", {
            bucketName: `fdr-${environmentType.toLowerCase()}-api-definition-source-files`,
            removalPolicy: RemovalPolicy.RETAIN,
            cors: [
                {
                    allowedMethods: [HttpMethods.GET, HttpMethods.POST, HttpMethods.PUT],
                    allowedOrigins: ["*"],
                    allowedHeaders: ["*"]
                }
            ],
            versioned: true
        });

        const privateDocsBucket = new Bucket(this, "fdr-docs-files", {
            bucketName: `fdr-${environmentType.toLowerCase()}-docs-files`,
            removalPolicy: RemovalPolicy.RETAIN,
            cors: [
                {
                    allowedMethods: [HttpMethods.GET, HttpMethods.POST, HttpMethods.PUT],
                    allowedOrigins: ["*"],
                    allowedHeaders: ["*"]
                }
            ],
            versioned: true
        });

        const libraryDocsBucket = new Bucket(this, "fdr-library-docs-files", {
            bucketName: `fdr-${environmentType.toLowerCase()}-library-docs-files`,
            removalPolicy: RemovalPolicy.RETAIN,
            cors: [
                {
                    allowedMethods: [HttpMethods.GET, HttpMethods.POST, HttpMethods.PUT],
                    allowedOrigins: ["*"],
                    allowedHeaders: ["*"]
                }
            ],
            versioned: true
        });

        const pdfExportBucket = new Bucket(this, "fdr-pdf-export-files", {
            bucketName: `fdr-${environmentType.toLowerCase()}-pdf-export-files`,
            removalPolicy: RemovalPolicy.RETAIN,
            cors: [
                {
                    allowedMethods: [HttpMethods.GET, HttpMethods.POST, HttpMethods.PUT],
                    allowedOrigins: ["*"],
                    allowedHeaders: ["*"]
                }
            ],
            versioned: true
        });

        const publicDocsBucket = new Bucket(this, "fdr-docs-files-public", {
            bucketName: `fdr-${environmentType.toLowerCase()}-docs-files-public`,
            removalPolicy: RemovalPolicy.RETAIN,
            cors: [
                {
                    allowedMethods: [HttpMethods.GET, HttpMethods.POST, HttpMethods.PUT],
                    allowedOrigins: ["*"],
                    allowedHeaders: ["*"]
                }
            ],
            blockPublicAccess: {
                blockPublicAcls: false,
                blockPublicPolicy: false,
                ignorePublicAcls: false,
                restrictPublicBuckets: false
            },
            versioned: true
        });
        publicDocsBucket.grantPublicAccess();

        const publicDocsFilesDomainName = getPublicBucketDomainName(environmentType, environmentInfo);
        const publicDocsFilesDistribution = new cloudfront.Distribution(this, "PublicDocsFilesDistribution", {
            defaultBehavior: {
                origin: new origins.S3Origin(publicDocsBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
            },
            domainNames: [publicDocsFilesDomainName],
            certificate
        });

        // for revalidate-all and finish-register workflow
        const dbDocsDefinitionBucket = new Bucket(this, "fdr-docs-definitions-public", {
            bucketName: `fdr-${environmentType.toLowerCase()}-docs-definitions-public`,
            cors: [
                {
                    allowedMethods: [HttpMethods.GET, HttpMethods.POST, HttpMethods.PUT],
                    allowedOrigins: ["*"],
                    allowedHeaders: ["*"]
                }
            ],
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            versioned: true
        });

        new route53.ARecord(this, "PublicDocsFilesRecord", {
            recordName: publicDocsFilesDomainName,
            target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(publicDocsFilesDistribution)),
            zone: hostedZone
        });

        const fernDocsCacheEndpoint = this.constructElastiCacheInstance(this, {
            cacheName: options.cacheName,
            IVpc: vpc,
            numCacheShards: 1,
            numCacheReplicasPerShard: 1,
            clusterMode: "enabled",
            cacheNodeType: options.cacheNodeType,
            envType: environmentType,
            env: props?.env,
            ingressSecurityGroup: fdrSg
        });

        const cloudmapNamespaceName = environmentInfo.cloudMapNamespaceInfo.namespaceName;
        const cloudMapNamespace = PrivateDnsNamespace.fromPrivateDnsNamespaceAttributes(this, "private-cloudmap", {
            namespaceArn: environmentInfo.cloudMapNamespaceInfo.namespaceArn,
            namespaceId: environmentInfo.cloudMapNamespaceInfo.namespaceId,
            namespaceName: cloudmapNamespaceName
        });

        const pdfExportDlq = new sqs.Queue(this, "pdf-export-dlq", {
            queueName: `pdf-export-dlq-${environmentType.toLowerCase()}.fifo`,
            fifo: true,
            retentionPeriod: Duration.days(14)
        });

        const pdfExportQueue = new sqs.Queue(this, "pdf-export-queue", {
            queueName: `pdf-export-queue-${environmentType.toLowerCase()}.fifo`,
            fifo: true,
            // Producer sets MessageDeduplicationId explicitly; keep content-based dedup off.
            contentBasedDeduplication: false,
            // Must be >= Lambda timeout; leave some buffer for retries/cleanup.
            visibilityTimeout: Duration.minutes(20),
            retentionPeriod: Duration.days(14),
            deadLetterQueue: {
                queue: pdfExportDlq,
                maxReceiveCount: 1
            }
        });

        // --- PDF Exporter: Fargate task (replaces the old Lambda) ---

        const pdfExporterContainerName = "docs-pdf-exporter";

        const pdfExporterTaskDef = new ecs.FargateTaskDefinition(this, "pdf-exporter-task-def", {
            family: `docs-pdf-exporter-${environmentType.toLowerCase()}`,
            cpu: 16384, // 16 vCPU
            memoryLimitMiB: 32768, // 32 GB
            ephemeralStorageGiB: 30,
            runtimePlatform: {
                cpuArchitecture: ecs.CpuArchitecture.X86_64,
                operatingSystemFamily: ecs.OperatingSystemFamily.LINUX
            }
        });

        pdfExporterTaskDef.addContainer(pdfExporterContainerName, {
            image: ecs.ContainerImage.fromAsset(path.join(__dirname, "../../docs-pdf-exporter"), {
                file: "Dockerfile.fargate"
            }),
            environment: {
                NODE_ENV: "production",
                PDF_EXPORT_FERN_TOKEN: getEnvironmentVariableOrThrow("PDF_EXPORT_FERN_TOKEN"),
                PDF_EXPORT_JWT_SECRET_KEY: getEnvironmentVariableOrThrow("PDF_EXPORT_JWT_SECRET_KEY")
            },
            logging: ecs.LogDriver.awsLogs({
                logGroup,
                streamPrefix: "pdf-exporter"
            })
        });

        const pdfExporterSg = new SecurityGroup(this, "pdf-exporter-sg", {
            securityGroupName: `pdf-exporter-${environmentType.toLowerCase()}`,
            vpc,
            allowAllOutbound: true,
            description: "Security group for the PDF exporter Fargate task (outbound only)"
        });

        // EventBridge Pipe: SQS FIFO → ECS RunTask
        // The pipe reads messages from the queue, launches a Fargate task per
        // message, and passes the SQS message body as the PDF_EXPORT_MESSAGE
        // environment variable via container override.
        const pipeRole = new Role(this, "pdf-export-pipe-role", {
            roleName: `pdf-export-pipe-${environmentType.toLowerCase()}`,
            assumedBy: new ServicePrincipal("pipes.amazonaws.com"),
            inlinePolicies: {
                sqsSource: new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
                            resources: [pdfExportQueue.queueArn]
                        })
                    ]
                }),
                ecsTarget: new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: ["ecs:RunTask"],
                            resources: [pdfExporterTaskDef.taskDefinitionArn]
                        }),
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: ["iam:PassRole"],
                            resources: [pdfExporterTaskDef.taskRole.roleArn, pdfExporterTaskDef.executionRole!.roleArn]
                        })
                    ]
                })
            }
        });

        new CfnPipe(this, "pdf-export-pipe", {
            name: `pdf-export-pipe-${environmentType.toLowerCase()}`,
            roleArn: pipeRole.roleArn,
            source: pdfExportQueue.queueArn,
            sourceParameters: {
                sqsQueueParameters: {
                    batchSize: 1
                }
            },
            target: cluster.clusterArn,
            targetParameters: {
                ecsTaskParameters: {
                    taskDefinitionArn: pdfExporterTaskDef.taskDefinitionArn,
                    taskCount: 1,
                    launchType: "FARGATE",
                    networkConfiguration: {
                        awsvpcConfiguration: {
                            subnets: vpc.publicSubnets.map((s) => s.subnetId),
                            securityGroups: [pdfExporterSg.securityGroupId],
                            assignPublicIp: "ENABLED"
                        }
                    },
                    overrides: {
                        containerOverrides: [
                            {
                                name: pdfExporterContainerName,
                                environment: [
                                    {
                                        name: "PDF_EXPORT_MESSAGE",
                                        value: "$.body"
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        });

        new CfnOutput(this, "PdfExportQueueUrl", {
            value: pdfExportQueue.queueUrl
        });

        const fargateService = new ApplicationLoadBalancedFargateService(this, SERVICE_NAME, {
            serviceName: SERVICE_NAME,
            cluster,
            cpu: options.cpu,
            memoryLimitMiB: options.memory,
            desiredCount: options.desiredTaskCount,
            securityGroups: [fdrSg, efsSg],
            taskImageOptions: {
                image: ContainerImage.fromTarball(`../../docker/build/tar/fern-definition-registry:${version}.tar`),
                environment: {
                    VENUS_URL: `http://venus.${cloudmapNamespaceName}:8080/`,
                    AWS_ACCESS_KEY_ID: getEnvironmentVariableOrThrow("AWS_ACCESS_KEY_ID"),
                    AWS_SECRET_ACCESS_KEY: getEnvironmentVariableOrThrow("AWS_SECRET_ACCESS_KEY"),
                    PUBLIC_S3_BUCKET_NAME: publicDocsBucket.bucketName,
                    PUBLIC_S3_BUCKET_REGION: publicDocsBucket.stack.region,
                    PRIVATE_S3_BUCKET_NAME: privateDocsBucket.bucketName,
                    PRIVATE_S3_BUCKET_REGION: privateDocsBucket.stack.region,
                    DB_DOCS_DEFINITION_BUCKET_NAME: dbDocsDefinitionBucket.bucketName,
                    DB_DOCS_DEFINITION_BUCKET_REGION: dbDocsDefinitionBucket.stack.region,
                    API_DEFINITION_SOURCE_BUCKET_NAME: privateApiDefinitionSourceBucket.bucketName,
                    API_DEFINITION_SOURCE_BUCKET_REGION: privateApiDefinitionSourceBucket.stack.region,
                    LIBRARY_DOCS_S3_BUCKET_NAME: libraryDocsBucket.bucketName,
                    LIBRARY_DOCS_S3_BUCKET_REGION: libraryDocsBucket.stack.region,
                    PDF_EXPORT_S3_BUCKET_NAME: pdfExportBucket.bucketName,
                    PDF_EXPORT_S3_BUCKET_REGION: pdfExportBucket.stack.region,
                    RESEND_API_KEY: getEnvironmentVariableOrThrow("RESEND_API_KEY"),
                    PDF_EXPORT_SQS_QUEUE_URL: pdfExportQueue.queueUrl,
                    PDF_EXPORT_SQS_REGION: Stack.of(this).region,
                    PDF_EXPORT_JWT_SECRET_KEY: getEnvironmentVariableOrThrow("PDF_EXPORT_JWT_SECRET_KEY"),
                    PDF_EXPORT_CALLBACK_BASE_URL: `https://${getServiceDomainName(environmentType, environmentInfo)}`,
                    DOMAIN_SUFFIX: getDomainSuffix(environmentType),
                    SLACK_TOKEN: getEnvironmentVariableOrThrow("FERNIE_SLACK_APP_TOKEN"),
                    LOG_LEVEL: getLogLevel(environmentType),
                    DOCS_CACHE_ENDPOINT: fernDocsCacheEndpoint,
                    ENABLE_CUSTOMER_NOTIFICATIONS: (environmentType !== "DEV").toString(),
                    REDIS_ENABLED: options.redis.toString(),
                    REDIS_CLUSTERING_MODE_ENABLED: options.redisClusteringModeEnabled.toString(),
                    APPLICATION_ENVIRONMENT: getEnvironmentVariableOrThrow("APPLICATION_ENVIRONMENT"),
                    PUBLIC_DOCS_CDN_URL:
                        environmentType === "DEV2"
                            ? "https://files-dev2.buildwithfern.com"
                            : "https://files.buildwithfern.com",
                    NODE_ENV: "production",
                    PYTHON_LIBRARY_DOCS_LAMBDA_FUNCTION_NAME: `fdr-python-library-docs-parser-${environmentType.toLowerCase()}`,
                    PYTHON_LIBRARY_DOCS_LAMBDA_REGION: "us-east-1",
                    CPP_LIBRARY_DOCS_LAMBDA_FUNCTION_NAME: `fdr-cpp-library-docs-parser-${environmentType.toLowerCase()}`,
                    CPP_LIBRARY_DOCS_LAMBDA_REGION: "us-east-1",
                    // We only run this check in PROD for now
                    // The following auth0 and supabase variables are only needed for the CLI permission check
                    // So we set them to empty strings in non-PROD environments
                    CLI_PERMISSION_CHECK_ORG_IDS:
                        environmentType === "PROD" ? getEnvironmentVariableOrThrow("CLI_PERMISSION_CHECK_ORG_IDS") : "",
                    AUTH0_DOMAIN: environmentType === "PROD" ? "fern-prod.us.auth0.com" : "",
                    AUTH0_CLIENT_ID: environmentType === "PROD" ? "cpMvMkmORR9Z2XyRVsgfsNoTYc0ZI3GL" : "",
                    AUTH0_CLIENT_SECRET:
                        environmentType === "PROD" ? getEnvironmentVariableOrThrow("AUTH0_CLIENT_SECRET") : "",
                    AUTH0_ROLES:
                        environmentType === "PROD"
                            ? `{"admin":"rol_l9h69vRkXYa2eZQY","editor":"rol_BmdwfyKV22T2RkAH","viewer":"rol_uTGfGUuPE9KB2iBm", "cli": "rol_a5nxqhFWy9POyaLX", "fine_grain": "rol_pXAtQq1StidG0xqW"}`
                            : "",
                    SUPABASE_URL: environmentType === "PROD" ? getEnvironmentVariableOrThrow("SUPABASE_URL") : "",
                    SUPABASE_SERVICE_ROLE_KEY:
                        environmentType === "PROD" ? getEnvironmentVariableOrThrow("SUPABASE_SERVICE_ROLE_KEY") : "",
                    KV_REST_API_URL: process.env.KV_REST_API_URL ?? "",
                    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ?? "",
                    FDR_CRON_SECRET: getEnvironmentVariableOrThrow("FDR_CRON_SECRET")
                    // ENTITLEMENTS_ENABLED: (environmentType === "DEV2" || environmentType === "DEV").toString()
                },
                containerName: CONTAINER_NAME,
                containerPort: 8080,
                enableLogging: true,
                logDriver: LogDriver.awsLogs({
                    logGroup,
                    streamPrefix: SERVICE_NAME
                })
            },
            assignPublicIp: true,
            publicLoadBalancer: true,
            enableECSManagedTags: true,
            protocol: ApplicationProtocol.HTTPS,
            certificate,
            domainZone: hostedZone,
            domainName: getServiceDomainName(environmentType, environmentInfo),
            cloudMapOptions:
                cloudMapNamespace != null
                    ? {
                          cloudMapNamespace,
                          name: SERVICE_NAME
                      }
                    : undefined
        });
        if (options.redis) {
            const scalableTaskCount = fargateService.service.autoScaleTaskCount({
                maxCapacity: options.maxTaskCount,
                minCapacity: options.desiredTaskCount
            });
            scalableTaskCount.scaleOnRequestCount("RequestCountScaling", {
                targetGroup: fargateService.targetGroup,
                requestsPerTarget: 1000
            });
        }

        new ARecord(this, "api-domain", {
            zone: hostedZone,
            target: RecordTarget.fromAlias(new LoadBalancerTarget(fargateService.loadBalancer)),
            recordName: environmentType === "PROD" ? "api" : `api-${environmentType.toLowerCase()}`
        });

        // give permissions to access the docs definition bucket
        dbDocsDefinitionBucket.addToResourcePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["s3:GetObject"],
                resources: [dbDocsDefinitionBucket.arnForObjects("*")],
                principals: [
                    new ServicePrincipal("ecs-tasks.amazonaws.com"),
                    new ArnPrincipal(fargateService.taskDefinition.taskRole.roleArn)
                ]
            })
        );

        // Grant permission to invoke Python library docs Lambda
        const pythonLibraryDocsLambdaArn = `arn:aws:lambda:us-east-1:985111089818:function:fdr-python-library-docs-parser-${environmentType.toLowerCase()}`;
        fargateService.taskDefinition.taskRole.addToPrincipalPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["lambda:InvokeFunction"],
                resources: [pythonLibraryDocsLambdaArn]
            })
        );

        const efsVolume: Volume = {
            name: "fdr-volume",
            efsVolumeConfiguration: {
                fileSystemId: environmentInfo.efsInfo.fileSystemId,
                authorizationConfig: {
                    accessPointId: environmentInfo.efsInfo.fdrAccessPointId
                },
                transitEncryption: "ENABLED"
            }
        };
        fargateService.taskDefinition.addVolume(efsVolume);

        fargateService.taskDefinition.findContainer(CONTAINER_NAME)?.addMountPoints({
            containerPath: "/opt/var/data",
            sourceVolume: efsVolume.name,
            readOnly: false
        });

        fargateService.targetGroup.setAttribute("deregistration_delay.timeout_seconds", "30");

        fargateService.loadBalancer.setAttribute("idle_timeout.timeout_seconds", "900");

        fargateService.targetGroup.configureHealthCheck({
            healthyHttpCodes: "200",
            path: "/health",
            port: "8080",
            timeout: Duration.seconds(120),
            interval: Duration.seconds(150),
            unhealthyThresholdCount: 5
        });

        const lbResponseTimeAlarm = new Alarm(this, "fdr-lb-target-respones-time-alarm", {
            alarmName: `${id} Load Balancer Target Response Time Threshold`,
            metric: fargateService.loadBalancer.metrics.targetResponseTime(),
            threshold: 1,
            evaluationPeriods: 5
        });
        lbResponseTimeAlarm.addAlarmAction(new actions.SnsAction(snsTopic));

        const lbUnhealthyHostCountAlarm = new Alarm(this, "fdr-lb-unhealthy-host-count-alarm", {
            alarmName: `${id} Load Balancer Unhealthy Host Count Alarm`,
            metric: fargateService.targetGroup.metrics.unhealthyHostCount(),
            threshold: 1,
            evaluationPeriods: 5
        });
        lbUnhealthyHostCountAlarm.addAlarmAction(new actions.SnsAction(snsTopic));

        const lb500CountAlarm = new Alarm(this, "fdr-lb-5XX-count", {
            alarmName: `${id} Load Balancer 500 Error Alarm`,
            metric: fargateService.loadBalancer.metrics.httpCodeElb(HttpCodeElb.ELB_5XX_COUNT),
            threshold: 2,
            evaluationPeriods: 5
        });
        lb500CountAlarm.addAlarmAction(new actions.SnsAction(snsTopic));

        // --- PDF Export Cleanup: EventBridge Rule → API Destination (daily cron) ---

        const fdrCronSecret = getEnvironmentVariableOrThrow("FDR_CRON_SECRET");
        const fdrDomainName = getServiceDomainName(environmentType, environmentInfo);

        const cronConnection = new events.Connection(this, "fdr-cron-connection", {
            connectionName: `fdr-cron-${environmentType.toLowerCase()}`,
            authorization: events.Authorization.apiKey("x-fdr-cron-secret", SecretValue.unsafePlainText(fdrCronSecret)),
            description: "Connection for FDR cron-triggered endpoints"
        });

        const cleanupApiDestination = new events.ApiDestination(this, "pdf-export-cleanup-api-dest", {
            apiDestinationName: `pdf-export-cleanup-${environmentType.toLowerCase()}`,
            connection: cronConnection,
            endpoint: `https://${fdrDomainName}/pdf-export/cleanup`,
            httpMethod: events.HttpMethod.POST,
            description: "PDF export cleanup endpoint on FDR"
        });

        new events.Rule(this, "pdf-export-cleanup-rule", {
            ruleName: `pdf-export-cleanup-${environmentType.toLowerCase()}`,
            schedule: events.Schedule.cron({ hour: "0/6", minute: "0" }),
            targets: [new eventTargets.ApiDestination(cleanupApiDestination)]
        });

        const docsHomepageImagesBucket = new Bucket(this, "docs-homepage-images", {
            bucketName: `${environmentType.toLowerCase()}-docs-homepage-images`,
            cors: [
                {
                    allowedMethods: [HttpMethods.GET, HttpMethods.POST, HttpMethods.PUT],
                    allowedOrigins: ["*"],
                    allowedHeaders: ["*"]
                }
            ],
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            versioned: true
        });

        const vercelUser = User.fromUserName(this, "VercelUser", "vercel");

        docsHomepageImagesBucket.grantReadWrite(vercelUser);
    }

    private constructElastiCacheInstance(scope: Construct, props: ElastiCacheProps): string {
        const envPrefix = props.envType + "-";

        const cacheSecurityGroupName = envPrefix + props.cacheName + "SecurityGroup";
        const cacheSecurityGroup = new SecurityGroup(scope, cacheSecurityGroupName, {
            vpc: props.IVpc,
            allowAllOutbound: true,
            description: `${cacheSecurityGroupName} CDK`
        });

        const cacheSubnetGroupName = envPrefix + props.cacheName + "SubnetGroup";
        const cacheSubnetGroup = new CfnSubnetGroup(this, cacheSubnetGroupName, {
            description: `${cacheSubnetGroupName} CDK`,
            cacheSubnetGroupName,
            subnetIds: props.IVpc.publicSubnets.map(({ subnetId }) => subnetId)
        });

        const cacheReplicationGroupName = envPrefix + props.cacheName + "ReplicationGroup";
        const cacheReplicationGroup = new CfnReplicationGroup(this, cacheReplicationGroupName, {
            replicationGroupId: cacheReplicationGroupName,
            replicationGroupDescription: `Replication Group for the ${cacheReplicationGroupName} ElastiCache stack`,
            automaticFailoverEnabled: true,
            autoMinorVersionUpgrade: true,
            engine: "redis",
            engineVersion: "7.0",
            cacheParameterGroupName: "default.redis7.cluster.on",
            cacheNodeType: props.cacheNodeType,
            numNodeGroups: props.numCacheShards,
            replicasPerNodeGroup: props.numCacheReplicasPerShard,
            clusterMode: props.clusterMode,
            cacheSubnetGroupName: cacheSubnetGroup.ref,
            securityGroupIds: [cacheSecurityGroup.securityGroupId]
        });

        cacheReplicationGroup.cfnOptions.updatePolicy = {
            useOnlineResharding: true
        };

        cacheReplicationGroup.addDependency(cacheSubnetGroup);

        const cacheEndpointAddress = cacheReplicationGroup.attrConfigurationEndPointAddress;
        const cacheEndpointPort = cacheReplicationGroup.attrConfigurationEndPointPort;

        new CfnOutput(this, `${props.cacheName}Host`, {
            value: cacheEndpointAddress
        });
        new CfnOutput(this, `${props.cacheName}Port`, { value: cacheEndpointPort });

        cacheSecurityGroup.addIngressRule(
            props.ingressSecurityGroup || Peer.anyIpv4(),
            Port.tcp(Token.asNumber(cacheEndpointPort)),
            "Redis Port Ingress rule"
        );

        return `${cacheEndpointAddress}:${cacheEndpointPort}`;
    }
}

function getServiceDomainName(environmentType: EnvironmentType, environmentInfo: EnvironmentInfo) {
    if (environmentType === EnvironmentType.Prod) {
        return "registry" + "." + environmentInfo.route53Info.hostedZoneName;
    }
    return "registry" + "-" + environmentType.toLowerCase() + "." + environmentInfo.route53Info.hostedZoneName;
}

function getPublicBucketDomainName(environmentType: EnvironmentType, environmentInfo: EnvironmentInfo) {
    if (environmentType === EnvironmentType.Prod) {
        return "files" + "." + environmentInfo.route53Info.hostedZoneName;
    }
    return "files" + "-" + environmentType.toLowerCase() + "." + environmentInfo.route53Info.hostedZoneName;
}

function getEnvironmentVariableOrThrow(environmentVariable: string): string {
    const value = process.env[environmentVariable];
    if (value == null) {
        throw new Error(`Environment variable ${environmentVariable} not found`);
    }
    return value;
}

function getLogLevel(environmentType: EnvironmentType): string {
    switch (environmentType) {
        case "DEV":
        case "DEV2":
            return "debug";
        case "PROD":
            return "info";
        default:
            assertNever(environmentType);
    }
}

function getDomainSuffix(environmentType: EnvironmentType): string {
    switch (environmentType) {
        case "DEV":
        case "DEV2":
            return "docs.dev.buildwithfern.com";
        case "PROD":
            return "docs.buildwithfern.com";
        default:
            assertNever(environmentType);
    }
}

function assertNever(x: never): never {
    throw new Error("Unexpected value: " + JSON.stringify(x));
}
