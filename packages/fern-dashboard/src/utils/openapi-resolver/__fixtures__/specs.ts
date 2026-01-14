/**
 * Shared OpenAPI spec fixtures for tests.
 */

export const SIMPLE_SPEC = `
openapi: 3.0.0
info:
  title: Test API
  description: Test API description
paths:
  /users/{id}:
    get:
      operationId: getUser
      description: Get a user by ID
      parameters:
        - name: id
          in: path
          description: User ID parameter
        - name: include
          in: query
          description: Include additional data
        - name: X-Request-ID
          in: header
          description: Request ID header
      responses:
        '200':
          description: Success response
        '404':
          description: Not found error
    post:
      operationId: createUser
      description: Create a user
      requestBody:
        description: User creation payload
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/User'
      responses:
        '201':
          description: Created
  /files:
    post:
      operationId: uploadFile
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                document:
                  type: string
                  format: binary
                  description: File to upload
                metadata:
                  type: string
                  description: File metadata
components:
  schemas:
    User:
      type: object
      description: A user entity
      properties:
        name:
          type: string
          description: User name
        email:
          type: string
          description: User email address
        address:
          type: object
          properties:
            street:
              type: string
              description: Street address
            city:
              type: string
              description: City name
    Status:
      type: string
      enum:
        - ACTIVE
        - INACTIVE
      x-enum-descriptions:
        ACTIVE: User is active
        INACTIVE: User is inactive
`;

export const SPEC_WITH_REFS = `
openapi: 3.0.0
paths:
  /products:
    post:
      operationId: createProduct
      requestBody:
        $ref: '#/components/requestBodies/CreateProduct'
      responses:
        '200':
          $ref: '#/components/responses/ProductResponse'
components:
  requestBodies:
    CreateProduct:
      description: Create product request body
      content:
        application/json:
          schema:
            type: object
  responses:
    ProductResponse:
      description: Product response description
  schemas:
    RefSchema:
      $ref: '#/components/schemas/ActualSchema'
    ActualSchema:
      type: object
      description: The actual schema
      properties:
        name:
          type: string
          description: Name property
`;

export const SPEC_WITH_COMPOSITION = `
openapi: 3.0.0
components:
  schemas:
    ExtendedUser:
      allOf:
        - $ref: '#/components/schemas/BaseUser'
        - type: object
          properties:
            extra:
              type: string
    BaseUser:
      type: object
      properties:
        id:
          type: string
    OneOfExample:
      oneOf:
        - type: object
          properties:
            foo:
              type: string
        - type: object
          properties:
            bar:
              type: string
`;

export const SPEC_WITH_PATH_LEVEL_PARAMS = `
openapi: 3.0.0
paths:
  /items/{itemId}:
    parameters:
      - name: itemId
        in: path
        description: Item ID at path level
    get:
      operationId: getItem
      description: Get item
      responses:
        '200':
          description: OK
`;

export const OVERRIDE_MAIN_SPEC = `
openapi: 3.0.0
paths:
  /users:
    get:
      operationId: getUsers
      description: Main spec description
components:
  schemas:
    User:
      type: object
      description: User schema
`;

export const OVERRIDE_SPEC = `
openapi: 3.0.0
paths:
  /users:
    get:
      operationId: getUsers
      description: Override description
`;

export const EMPTY_OVERRIDE = `
openapi: 3.0.0
paths: {}
`;

export const SPEC_WITH_RESPONSE_REF = `
openapi: 3.0.0
paths:
  /plant:
    post:
      operationId: addPlant
      description: Add a new plant
      requestBody:
        description: Plant details
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PlantRequest'
      responses:
        '200':
          description: Plant successfully added
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PlantResponse'
components:
  schemas:
    PlantRequest:
      type: object
      properties:
        name:
          type: string
          description: Plant name
        species:
          type: string
          description: Plant species
    PlantResponse:
      type: object
      properties:
        id:
          type: string
          description: Plant ID
        name:
          type: string
          description: Plant name
`;

// Override file with inline properties for a $ref schema (invalid but may exist from legacy edits)
// This should NOT be read - the main spec's component schema should be used instead
export const OVERRIDE_WITH_INLINE_PROPS = `
openapi: 3.0.0
paths:
  /plant:
    post:
      responses:
        '200':
          content:
            application/json:
              schema:
                properties:
                  id:
                    description: CC (inline override - should be ignored)
components:
  schemas:
    PlantResponse:
      properties:
        id:
          description: AA (component override - should be used)
`;

// Spec with array response that uses $ref items
export const SPEC_WITH_ARRAY_RESPONSE = `
openapi: 3.0.0
paths:
  /plant/search/status:
    get:
      operationId: searchPlantsByStatus
      description: Search plants by status
      responses:
        '200':
          description: List of plants
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/PlantResponse'
components:
  schemas:
    PlantResponse:
      type: object
      properties:
        id:
          type: string
          description: Plant ID
        name:
          type: string
          description: Plant name
`;

// Override file with component schema values for array response test
export const OVERRIDE_WITH_COMPONENT_VALUES = `
openapi: 3.0.0
components:
  schemas:
    PlantResponse:
      properties:
        id:
          description: AA
        name:
          description: BB
`;
