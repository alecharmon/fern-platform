from anthropic import AsyncAnthropic
from fastapi import Body
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from src.fai.api_models.chat import ChatCompletionRequest
from src.fai.app import fai_app
from src.fai.utils.chat.get_base_system_prompt import get_base_system_prompt
from src.fai.utils.chat.run_rag_on_query import run_rag_on_query
from src.settings import LOGGER
from src.settings import VARIABLES


@fai_app.post("/chat/{domain}")
async def chat(
    domain: str,
    body: ChatCompletionRequest = Body(...),
) -> JSONResponse:
    LOGGER.info(f"Chatting for domain {domain}")
    async with AsyncAnthropic(api_key=VARIABLES.ANTHROPIC_API_KEY) as anthropic_client:
        try:
            messages = [message.to_dict() for message in body.messages]
            last_user_message = body.messages[-1] if len(body.messages) > 0 else None
            if last_user_message:
                query = last_user_message.content
                documents = await run_rag_on_query(query, domain)
            else:
                documents = []

            if body.system_prompt:
                system_prompt = body.system_prompt
            else:
                system_prompt = get_base_system_prompt(domain, "\n\n".join(documents))

            if body.model:
                model = body.model
            else:
                model = "claude-4-sonnet-20250514"

            if model == "claude-4-sonnet-20250514":
                response = await anthropic_client.messages.create(
                    system=system_prompt,
                    model=model,
                    messages=messages,
                    max_tokens=1000,
                )
                response_content = response.content
                output = []
                for content_turn in response_content:
                    if content_turn.type == "text":
                        output.append({"type": "text", "text": content_turn.text})
                    elif content_turn.type == "tool_use":
                        output.append({"type": "tool_use", "input": content_turn.input})
                    elif content_turn.type == "tool_result":
                        output.append({"type": "thinking", "thinking": content_turn.thinking})
            else:
                raise ValueError(f"Model {model} not supported")

            return JSONResponse(content=jsonable_encoder(output))
        except Exception as e:
            LOGGER.exception(f"Failed to chat for domain {domain}")
            return JSONResponse(status_code=500, content={"detail": str(e)})
