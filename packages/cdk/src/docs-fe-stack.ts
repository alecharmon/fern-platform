import archiver from "archiver";
import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { AnyPrincipal, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket, HttpMethods } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import * as fs from "fs";
import path from "path";

import { EnvironmentType } from "@fern-fern/fern-cloud-sdk/api";

const LOCAL_PREVIEW_BUNDLE_OUT_DIR = path.resolve(
  __dirname,
  "../../fern-docs/bundle/.next"
);

export class DocsFeStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    environmentType: EnvironmentType,
    props?: StackProps
  ) {
    super(scope, id, props);
    const bucket = new Bucket(this, "local-preview-bundle3", {
      bucketName: `${environmentType.toLowerCase()}-local-preview-bundle3`,
      removalPolicy: RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [HttpMethods.GET, HttpMethods.POST, HttpMethods.PUT],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
      versioned: true,
      publicReadAccess: true,
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
    });
    bucket.addToResourcePolicy(
      new PolicyStatement({
        resources: [bucket.arnForObjects("*"), bucket.bucketArn],
        actions: ["s3:List*", "s3:Get*"],
        principals: [new AnyPrincipal()],
      })
    );

    const local_preview_bundle_dist_zip = path.resolve(
      __dirname,
      "../../fern-docs/bundle/next.zip"
    );
    if (
      !fs.existsSync(LOCAL_PREVIEW_BUNDLE_OUT_DIR) ||
      !fs.lstatSync(LOCAL_PREVIEW_BUNDLE_OUT_DIR).isDirectory()
    ) {
      throw new Error(
        `Local preview bundle not found at ${LOCAL_PREVIEW_BUNDLE_OUT_DIR}`
      );
    }

    // Copy install-esbuild.js into the .next folder
    fs.promises
      .copyFile(
        path.resolve(__dirname, "../utilities/install-esbuild.js"),
        path.join(LOCAL_PREVIEW_BUNDLE_OUT_DIR, "install-esbuild.js")
      )
      .then(() => {
        return zipFolder(
          LOCAL_PREVIEW_BUNDLE_OUT_DIR,
          local_preview_bundle_dist_zip
        );
      })
      .then(() => {
        new BucketDeployment(this, "deploy-local-preview-bundle3", {
          sources: [Source.asset(local_preview_bundle_dist_zip)],
          destinationBucket: bucket,
          extract: false,
          memoryLimit: 1024,
        });
      })
      .catch((error: unknown) => {
        throw new Error(
          `Failed to prepare and deploy bundle: ${error instanceof Error ? error.message : String(error)}`
        );
      });
  }
}

function mkdir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

async function zipFolder(sourceFolder: string, zipFilePath: string) {
  mkdir(path.dirname(zipFilePath));

  return new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver("zip");

    archive.on("error", (err: unknown) => {
      reject(err instanceof Error ? err : new Error(String(err)));
    });

    output.on("close", function () {
      resolve();
    });

    archive.pipe(output);
    archive.directory(sourceFolder, false);
    void archive.finalize();
  });
}
