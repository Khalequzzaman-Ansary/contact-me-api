const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Contact API",
      version: "1.0.0",
      description: "API for contact form submissions + real-time stream (SSE)",
    },
    servers: [{ url: "/" }],
     tags: [{ name: "Health" }, { name: "Contact" }],
         tags: [{ name: "Health" }, { name: "Contact" }],

    components: {
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: { error: { type: "string" } },
        },
        ContactRequest: {
          type: "object",
          required: ["name", "email", "message"],
          properties: {
            name: { type: "string", minLength: 2, maxLength: 80, example: "Ada Lovelace" },
            email: { type: "string", format: "email", maxLength: 160, example: "ada@example.com" },
            message: { type: "string", minLength: 5, maxLength: 2000, example: "Hello from the contact form." },
          },
        },
        ContactMessage: {
          type: "object",
          properties: {
            id: { type: "integer", format: "int64", example: 1 },
            name: { type: "string", example: "Ada Lovelace" },
            email: { type: "string", format: "email", example: "ada@example.com" },
            message: { type: "string", example: "Hello from the contact form." },
            createdAt: { type: "string", format: "date-time" },
          },
        },
      },
    },

    paths: {
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          responses: {
            200: {
              description: "Server is healthy",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      uptime: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      "/api/contact": {
        post: {
          tags: ["Contact"],
          summary: "Submit a contact message",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ContactRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ContactMessage" },
                },
              },
            },
            400: {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
        get: {
          tags: ["Contact"],
          summary: "List contact messages",
          responses: {
            200: {
              description: "List of messages",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ContactMessage" },
                  },
                },
              },
            },
          },
        },
      },

      "/api/contact/stream": {
        get: {
          tags: ["Contact"],
          summary: "Server-Sent Events stream of new contact messages",
          description:
            "Sends SSE events. Clients should set Accept: text/event-stream and keep the connection open.",
          responses: {
            200: {
              description: "SSE stream",
              content: {
                "text/event-stream": {
                  schema: { type: "string" },
                  example: "event: ping\\ndata: {}\\n\\n",
                },
              },
            },
          },
        },
      },
    },
 },
  apis: [],
};

module.exports = swaggerJSDoc(options);
