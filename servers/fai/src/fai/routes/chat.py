from typing import Any
from typing import Dict
from typing import List

from anthropic import AsyncAnthropic
from fastapi import Body
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from src.fai.api_models.chat import ChatCompletionRequest
from src.fai.app import fai_app
from src.fai.utils.chat.get_base_system_prompt import get_base_system_prompt
from src.fai.utils.chat.run_rag_on_query import run_rag_on_query
from src.fai.utils.chat.search_tool import search_tool
from src.settings import LOGGER
from src.settings import VARIABLES


@fai_app.post("/chat/{domain}")
async def chat(
    domain: str,
    body: ChatCompletionRequest = Body(...),
) -> JSONResponse:
    async def handle_tool_use(tool_use: Any, domain: str) -> Dict[str, str]:
        if tool_use.name == "search":
            query = tool_use.input["query"]
            documents = await run_rag_on_query(query, domain)
            return {"tool_use_id": tool_use.id, "output": "\n\n".join(documents)}
        else:
            return {"tool_use_id": tool_use.id, "output": "Tool not supported."}

    LOGGER.info(f"Chatting for domain {domain}")
    async with AsyncAnthropic(api_key=VARIABLES.ANTHROPIC_API_KEY) as anthropic_client:
        try:
            messages: List[Dict[str, Any]] = [message.to_dict() for message in body.messages]
            last_user_message = body.messages[-1] if len(body.messages) > 0 else None

            documents = []
            if last_user_message:
                documents = await run_rag_on_query(last_user_message.content, domain)

            system_prompt = (
                body.system_prompt if body.system_prompt else get_base_system_prompt(domain, "\n\n".join(documents))
            )
            model = body.model or "claude-4-sonnet-20250514"

            if model != "claude-4-sonnet-20250514":
                raise ValueError(f"Model {model} not supported")

            response = await anthropic_client.messages.create(
                system=system_prompt,
                model=model,
                messages=messages,
                max_tokens=1000,
                tools=[search_tool],
            )

            output = []
            for turn in response.content:
                if turn.type == "text":
                    output.append({"type": "text", "text": turn.text})

            tool_uses = [turn for turn in response.content if turn.type == "tool_use"]
            if tool_uses:
                tool_results = []
                for tool_use in tool_uses:
                    result = await handle_tool_use(tool_use, domain)
                    tool_results.append(
                        {"type": "tool_result", "tool_use_id": result["tool_use_id"], "content": result["output"]}
                    )

                messages.append({"role": "assistant", "content": response.content})

                messages.append({"role": "user", "content": tool_results})

                response = await anthropic_client.messages.create(
                    system=system_prompt,
                    model=model,
                    messages=messages,
                    max_tokens=1000,
                )

            for turn in response.content:
                if turn.type == "text":
                    output.append({"type": "text", "text": turn.text})

            return JSONResponse(content=jsonable_encoder(output))

        except Exception as e:
            LOGGER.exception(f"Failed to chat for domain {domain}")
            return JSONResponse(status_code=500, content={"detail": str(e)})
