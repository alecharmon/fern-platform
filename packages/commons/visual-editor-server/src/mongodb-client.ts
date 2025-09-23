import { attachDatabasePool } from "@vercel/functions";
import {
  type Collection,
  type Db,
  MongoClient,
  type MongoClientOptions,
} from "mongodb";

import { DocsV2Read } from "@fern-api/fdr-sdk";

export interface VisualEditorDocument {
  _id: string;
  domain: string;
  branchName: string;
  data: DocsV2Read.LoadDocsForUrlResponse;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

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
  private collection: Collection<VisualEditorDocument> | null = null;

  private async ensureConnection(): Promise<Collection<VisualEditorDocument>> {
    if (this.collection) {
      return this.collection;
    }

    if (!clientPromise) {
      throw new Error("MONGODB_URI environment variable is not set");
    }

    const client = await clientPromise;
    this.db = client.db("visual-editor");
    this.collection = this.db.collection<VisualEditorDocument>("fdr-data");

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

  async set(
    domain: string,
    branchName: string,
    data: DocsV2Read.LoadDocsForUrlResponse
  ): Promise<void> {
    const collection = await this.ensureConnection();

    const now = new Date();

    const document: VisualEditorDocument = {
      _id: this.getDocumentId(domain, branchName),
      domain,
      branchName,
      data,
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

    return document.data;
  }
}

export const mongoClient: VisualEditorMongoClient =
  new VisualEditorMongoClient();
