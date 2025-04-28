"use client";

import { useEffect } from "react";

import { isLocal } from "@/server/isLocal";

export function WebSocketRefresh() {
  useEffect(() => {
    let ws: WebSocket | null = null;
    let timeout: NodeJS.Timeout | null = null;

    const setupWebSocket = async (): Promise<void> => {
      if (!isLocal()) {
        console.log("Not in local mode, skipping WebSocket connection");
        return;
      }

      // Ensure we're in a browser environment
      if (typeof window === "undefined") {
        console.log(
          "Not in browser environment, skipping WebSocket connection"
        );
        return;
      }

      // Ensure WebSocket is available
      if (typeof WebSocket === "undefined") {
        console.error("WebSocket is not available in this environment");
        return;
      }

      const response = await fetch("/api/fern-docs/env-local");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (!data.backendPort) {
        console.error("No port found in env-local response");
        return;
      }

      const wsUrl = `ws://localhost:${data.backendPort}`;

      console.log(`Attempting to connect to WebSocket server at ${wsUrl}...`);

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("Client: Successfully connected to WebSocket server");
        };

        ws.onmessage = async (event) => {
          console.log("Client: Received WebSocket message:", event.data);

          try {
            const message = JSON.parse(event.data);
            console.log("Client: Parsed message:", message);

            if (message.type === "finishReload") {
              console.log(
                "Client: Received finishReload message, calling revalidate-local endpoint"
              );
              try {
                const response = await fetch("/api/fern-docs/revalidate-local");
                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }
                console.log("Client: Successfully revalidated");
                // Reload the page after revalidation
                window.location.reload();
              } catch (error) {
                console.error("Client: Failed to revalidate:", error);
              }
            }
          } catch (error) {
            console.error("Client: Failed to parse WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("Client: WebSocket error:", error);
        };

        ws.onclose = (event) => {
          console.log(
            `Client: WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`
          );
        };

        // Add connection timeout check
        timeout = setTimeout(() => {
          if (ws?.readyState !== WebSocket.OPEN) {
            console.error(
              "Client: WebSocket connection failed to establish within 5 seconds"
            );
          }
        }, 5000);
      } catch (error) {
        console.error("Client: Failed to create WebSocket connection:", error);
      }
    };

    void setupWebSocket();

    return () => {
      console.log("Client: Cleaning up WebSocket connection");
      if (timeout) {
        clearTimeout(timeout);
      }
      if (ws) {
        ws.close();
      }
    };
  }, []);

  return null;
}
