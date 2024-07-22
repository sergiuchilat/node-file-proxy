const swaggerJsdoc = require("swagger-jsdoc");

const swaggerConfig = swaggerJsdoc({
    definition: {
        openapi: "3.1.0",
        info: {
            title: "Node file proxy",
            version: "0.1.0",
            description: "This is a simple CRUD API application made with Express and documented with Swagger",
        },
        servers: [
            {
                url: "http://localhost:3000",
            },
        ],
    },
    apis: ["./src/app.js"],
});

module.exports = swaggerConfig;
