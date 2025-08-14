class LanguageModel:
    def __init__(self, model_name: str, model_id: str, model_provider: str):
        self.model_name = model_name
        self.model_id = model_id
        self.model_provider = model_provider


class EmbeddingModel(LanguageModel):
    def __init__(self, model_name: str, model_id: str, model_provider: str):
        super().__init__(model_name, model_id, model_provider)


class ChatModel(LanguageModel):
    def __init__(self, model_name: str, model_id: str, model_provider: str):
        super().__init__(model_name, model_id, model_provider)
