import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { Pool } from "pg";

// Create connection pool outside handler for connection reuse
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1, // Lambda best practice: use minimal connections
  idleTimeoutMillis: 120000, // 2 minutes - align with typical Lambda timeout
  connectionTimeoutMillis: 60000, // 60 seconds - enough for RDS Proxy cold start
});

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log("Event:", JSON.stringify(event, null, 2));
  console.log("Context:", JSON.stringify(context, null, 2));

  try {
    // Simple queries to count API definitions and docs
    const apiDefinitionsResult = await pool.query(
      'SELECT COUNT(*) FROM "ApiDefinitionsV2"'
    );
    const docsResult = await pool.query('SELECT COUNT(*) FROM "Docs"');

    const apiDefinitionsCount = parseInt(apiDefinitionsResult.rows[0].count);
    const docsCount = parseInt(docsResult.rows[0].count);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Hello World from fdr-lambda!",
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId,
        database: {
          apiDefinitionsCount,
          docsCount,
        },
      }),
    };
  } catch (error) {
    console.error("Database error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Error querying database",
        error: error instanceof Error ? error.message : String(error),
        requestId: context.awsRequestId,
      }),
    };
  }
};
