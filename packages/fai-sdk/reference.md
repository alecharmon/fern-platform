# Reference

## Analytics

<details><summary><code>client.analytics.<a href="/src/api/resources/analytics/client/Client.ts">getHistogramAnalytics</a>(domain, { ...params }) -> FernFai.HistogramAnalytics</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieve the usage histogram analytics for a given period

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.analytics.getHistogramAnalytics("domain", {
    groupBy: "DAY",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**domain:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `FernFai.GetHistogramAnalyticsRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Analytics.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.analytics.<a href="/src/api/resources/analytics/client/Client.ts">getInsights</a>(domain, { ...params }) -> FernFai.Insights</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieve the insights for a given period

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.analytics.getInsights("domain");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**domain:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `FernFai.GetInsightsRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Analytics.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Chat

<details><summary><code>client.chat.<a href="/src/api/resources/chat/client/Client.ts">chatCompletion</a>(domain, { ...params }) -> FernFai.ChatCompletionResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Create a docs chat completion for a given domain

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.chat.chatCompletion("domain", {
    model: undefined,
    system_prompt: undefined,
    messages: [
        {
            role: "role",
            content: "content",
        },
        {
            role: "role",
            content: "content",
        },
    ],
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**domain:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `FernFai.ChatCompletionRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Chat.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Conversations

<details><summary><code>client.conversations.<a href="/src/api/resources/conversations/client/Client.ts">getConversation</a>(domain, conversationId) -> FernFai.Conversation</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieve a complete conversation by conversation id

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversations.getConversation("domain", "conversation_id");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**domain:** `string`

</dd>
</dl>

<dl>
<dd>

**conversationId:** `string`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Conversations.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Index

<details><summary><code>client.index.<a href="/src/api/resources/index/client/Client.ts">indexDocument</a>(domain, { ...params }) -> void</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Index a document for a given domain

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.index.indexDocument("domain", {
    index_name: undefined,
    document_id: "document_id",
    context: ["context", "context"],
    document: "document",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**domain:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `FernFai.IndexRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Index.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.index.<a href="/src/api/resources/index/client/Client.ts">getDocument</a>(domain, { ...params }) -> void</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get a document for a given domain

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.index.getDocument("domain", {
    document_id: "document_id",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**domain:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `FernFai.GetRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Index.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.index.<a href="/src/api/resources/index/client/Client.ts">updateDocument</a>(domain, { ...params }) -> FernFai.ContextResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Update a document for a given domain

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.index.updateDocument("domain", {
    document_id: "document_id",
    is_active: true,
    context: ["context", "context"],
    document: "document",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**domain:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `FernFai.UpdateRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Index.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.index.<a href="/src/api/resources/index/client/Client.ts">syncToQueryIndex</a>(domain, { ...params }) -> void</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Sync an index with the query index

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.index.syncToQueryIndex("domain", {
    index_name: "index_name",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**domain:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `FernFai.SyncIndexRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Index.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Queries

<details><summary><code>client.queries.<a href="/src/api/resources/queries/client/Client.ts">createQuery</a>({ ...params }) -> void</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Log a new query to the FAI DB

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.queries.createQuery({
    query_id: "query_id",
    conversation_id: "conversation_id",
    domain: "domain",
    text: "text",
    role: "role",
    source: "source",
    created_at: "2024-01-15T09:30:00Z",
    time_to_first_token: undefined,
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `FernFai.CreateQueryRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Queries.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.queries.<a href="/src/api/resources/queries/client/Client.ts">getRecentQueries</a>(domain, { ...params }) -> FernFai.QueryPage</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieve all paginated recent queries

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.queries.getRecentQueries("domain");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**domain:** `string` — The domain to retrieve queries for

</dd>
</dl>

<dl>
<dd>

**request:** `FernFai.GetRecentQueriesRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Queries.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>
