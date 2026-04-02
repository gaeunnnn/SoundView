from abc import ABC, abstractmethod
from typing import Any, TypeVar, Generic

T_IN = TypeVar("T_IN")
T_OUT = TypeVar("T_OUT")

class BaseAIModel(ABC, Generic[T_IN, T_OUT]):
    """
    모든 AI 모델 핸들러가 상속받아야 할 베이스 클래스입니다.
    특정 AI 모델의 로딩 및 추론(Predict) 로직만 담당합니다.
    """
    @abstractmethod
    async def predict(self, input_data: T_IN) -> T_OUT:
        pass

class BasePipeline(ABC):
    """
    AI 작업(Task)의 전체 파이프라인을 정의하는 베이스 클래스입니다.
    전처리 -> 추론 -> 후처리의 흐름을 관리합니다.
    """
    @abstractmethod
    async def preprocess(self, data: Any) -> Any:
        pass

    @abstractmethod
    async def postprocess(self, result: Any) -> Any:
        pass

    @abstractmethod
    async def run(self, data: Any) -> Any:
        """
        전체 파이프라인 실행 로직을 구현합니다.
        """
        pass
