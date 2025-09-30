import { attachDatabasePool } from "@vercel/functions";
import {
  Binary,
  type Collection,
  type Db,
  MongoClient,
  type MongoClientOptions,
} from "mongodb";
import { gunzip, gzip } from "zlib";

import { DocsV2Read } from "@fern-api/fdr-sdk";

type EditorDocument = {
  _id: string;
  domain: string;
  branchName: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
} & (
  | {
      // Old type for backwards compatibility
      data: DocsV2Read.LoadDocsForUrlResponse;
    }
  | {
      data: Binary;
      version: number;
    }
);

export type UnzippedEditorDocument = EditorDocument & {
  data: DocsV2Read.LoadDocsForUrlResponse;
};

const uri = process.env.MONGODB_URI;
const options: MongoClientOptions = {
  appName: "fern-visual-editor",
};

let client: MongoClient;
let clientPromise: Promise<MongoClient> | null = null;

if (uri) {
  if (process.env.NODE_ENV === "development") {
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
      _mongoClient?: MongoClient;
    };

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options);
      globalWithMongo._mongoClient = client;
      globalWithMongo._mongoClientPromise = client.connect();

      attachDatabasePool(client);
    }
    clientPromise = globalWithMongo._mongoClientPromise;
  } else {
    client = new MongoClient(uri, options);

    attachDatabasePool(client);

    clientPromise = client.connect();
  }
}

class VisualEditorMongoClient {
  private db: Db | null = null;
  private collection: Collection<EditorDocument> | null = null;

  private async ensureConnection(): Promise<Collection<EditorDocument>> {
    if (this.collection) {
      return this.collection;
    }

    if (!clientPromise) {
      throw new Error("MONGODB_URI environment variable is not set");
    }

    const client = await clientPromise;
    this.db = client.db("visual-editor");
    this.collection = this.db.collection<EditorDocument>("fdr-data");

    await this.collection.createIndex(
      { domain: 1, branchName: 1 },
      { unique: true }
    );
    await this.collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 }
    );

    return this.collection;
  }

  private getDocumentId(domain: string, branchName: string): string {
    return `${domain}::${branchName}`;
  }

  private zipCallback = (
    resolve: (value: Buffer) => void,
    reject: (reason?: any) => void,
    err: unknown,
    result: Buffer
  ) => {
    if (err) reject(err);
    else resolve(result);
  };

  private async compressData(
    data: DocsV2Read.LoadDocsForUrlResponse
  ): Promise<Binary> {
    const serialized = JSON.stringify(data);
    const compressed = await new Promise<Buffer>((resolve, reject) => {
      gzip(Buffer.from(serialized, "utf8"), (err, result) =>
        this.zipCallback(resolve, reject, err, result)
      );
    });
    return new Binary(compressed);
  }

  private async decompressData(
    data: Binary
  ): Promise<DocsV2Read.LoadDocsForUrlResponse> {
    try {
      // Ensure we have a proper Buffer from the Binary data
      const buffer = Buffer.isBuffer(data.buffer)
        ? data.buffer
        : Buffer.from(data.buffer);

      // Decompress the gzipped data
      const decompressed = await new Promise<Buffer>((resolve, reject) => {
        gunzip(buffer, (err, result) =>
          this.zipCallback(resolve, reject, err, result)
        );
      });

      // Parse the JSON
      const jsonString = decompressed.toString("utf8");
      return JSON.parse(jsonString) as DocsV2Read.LoadDocsForUrlResponse;
    } catch (error) {
      console.error("[decompressData] Failed to decompress data:", error);
      throw new Error(
        `Failed to decompress data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async set(
    domain: string,
    branchName: string,
    data: DocsV2Read.LoadDocsForUrlResponse
  ): Promise<void> {
    const collection = await this.ensureConnection();

    const now = new Date();

    const document: EditorDocument = {
      _id: this.getDocumentId(domain, branchName),
      domain,
      branchName,
      data: await this.compressData(data),
      version: 2,
      createdAt: now,
      updatedAt: now,
    };

    await collection.replaceOne({ _id: document._id }, document, {
      upsert: true,
    });
  }

  async get(
    domain: string,
    branchName: string
  ): Promise<DocsV2Read.LoadDocsForUrlResponse | null> {
    const collection = await this.ensureConnection();

    const document = await collection.findOne({
      _id: this.getDocumentId(domain, branchName),
    });

    if (!document) {
      return null;
    }

    if ("version" in document) {
      return this.decompressData(document.data);
    }

    return document.data;
  }

  async findDocumentsForBranches(
    branchNames: string[]
  ): Promise<UnzippedEditorDocument[]> {
    const collection = await this.ensureConnection();

    const documents = await collection
      .find({
        branchName: { $in: branchNames },
      })
      .toArray();

    if (!documents) {
      return [];
    }

    const decompressedDocuments = (
      await Promise.all(
        documents.map(async (document) => {
          try {
            const decompressedData =
              "version" in document
                ? await this.decompressData(document.data)
                : document.data;
            return {
              ...document,
              data: decompressedData,
            };
          } catch (error) {
            console.error(
              "[findDocumentsForBranches] Failed to decompress data:",
              error
            );
            return undefined;
          }
        })
      )
    ).filter((document) => document != null);
    return decompressedDocuments;
  }
}

export const mongoClient: VisualEditorMongoClient =
  new VisualEditorMongoClient();
