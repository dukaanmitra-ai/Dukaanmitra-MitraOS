"""
DukaanMitra AI Engine - LangChain + CrewAI Integration
Cloud-native AI models for business intelligence
"""

from langchain.agents import AgentExecutor, create_openai_functions_agent, Tool
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.memory import ConversationBufferMemory
from langchain.schema import SystemMessage
from typing import List, Dict, Any
import os
import json

# ============================================================================
# DukaanMitra AI Brain with LangChain
# ============================================================================

class DukaanMitraAIBrain:
    """Unified AI brain using LangChain for business intelligence"""

    def __init__(self, api_key: str = None, model: str = "gpt-4"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.llm = ChatOpenAI(
            api_key=self.api_key,
            model=model,
            temperature=0.7
        )
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True
        )

    def create_business_agent(self, tools: List[Tool]) -> AgentExecutor:
        """Create a business intelligence agent with tools"""

        prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content="""You are DukaanMitra AI, a business intelligence assistant for Indian MSMEs and retailers.
You help with:
- Inventory management and stock optimization
- Customer insights and retention strategies
- Sales analysis and growth recommendations
- GST compliance and invoicing
- WhatsApp marketing and customer engagement

Always provide practical, actionable advice in simple Hindi/English (Hinglish) when appropriate.
Be concise and specific."""),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])

        agent = create_openai_functions_agent(self.llm, tools, prompt)
        agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            memory=self.memory,
            verbose=True,
            handle_parsing_errors=True
        )

        return agent_executor

    def query(self, question: str, tools: List[Tool] = None) -> str:
        """Query the AI brain with business question"""

        if tools is None:
            tools = self.get_default_tools()

        agent = self.create_business_agent(tools)
        result = agent.invoke({"input": question})

        return result["output"]

    def get_default_tools(self) -> List[Tool]:
        """Get default business intelligence tools"""

        tools = [
            Tool(
                name="get_inventory_status",
                func=self._get_inventory_status,
                description="Get current inventory status, low stock items, and reorder recommendations"
            ),
            Tool(
                name="analyze_sales_trends",
                func=self._analyze_sales_trends,
                description="Analyze recent sales trends and provide growth insights"
            ),
            Tool(
                name="customer_insights",
                func=self._customer_insights,
                description="Get customer behavior insights and retention recommendations"
            ),
            Tool(
                name="generate_marketing_copy",
                func=self._generate_marketing_copy,
                description="Generate marketing copy for WhatsApp, Instagram, or other platforms"
            ),
            Tool(
                name="gst_compliance_check",
                func=self._gst_compliance_check,
                description="Check GST compliance status and get invoicing recommendations"
            )
        ]

        return tools

    def _get_inventory_status(self, query: str) -> str:
        """Tool: Get inventory status"""
        # In production, this would query the actual database
        return """Current Inventory Status:
- Total Products: 245
- Low Stock Items: 12
- Out of Stock: 3
- Total Stock Value: ₹4,52,000

Recommendations:
1. Reorder bread, milk, eggs immediately (high turnover)
2. Consider reducing stock of slow-moving items (6 products)
3. Track seasonal items for optimal ordering"""

    def _analyze_sales_trends(self, query: str) -> str:
        """Tool: Analyze sales trends"""
        return """Sales Analysis (Last 30 Days):
- Total Revenue: ₹2,45,000
- Growth Rate: +12.5% vs previous month
- Top Selling Categories: Groceries (45%), Dairy (25%), Snacks (15%)
- Peak Hours: 8-10 AM and 6-8 PM

Insights:
- Morning rush customers buy breakfast items
- Evening customers buy dinner essentials
- Weekend sales 30% higher than weekdays
- Consider extending evening hours on weekends"""

    def _customer_insights(self, query: str) -> str:
        """Tool: Get customer insights"""
        return """Customer Insights:
- Total Customers: 1,245
- Active Customers (30 days): 892
- Average Order Value: ₹285
- Repeat Purchase Rate: 42%

Retention Recommendations:
1. Send WhatsApp offers to 53 inactive customers (30+ days)
2. Loyalty program could increase repeat rate by 15%
3. Bulk purchase discounts for top 20 customers
4. Birthday/anniversary special offers"""

    def _generate_marketing_copy(self, query: str) -> str:
        """Tool: Generate marketing copy"""
        return """Marketing Copy Options:

Option 1 (WhatsApp):
🛒 Special Offer! 🛒
Aashirvaad Atta 5kg - ₹299 (MRP ₹325)
Stock available only for today!
WhatsApp: 9876543210 to order

Option 2 (Instagram):
✨ Fresh Stock Alert! ✨
Premium quality Aashirvaad Atta now at best price
📍 Store: DukaanMitra Kirana
📱 Order via WhatsApp for home delivery
#dukaanmitra #kirana #freshstock"""

    def _gst_compliance_check(self, query: str) -> str:
        """Tool: GST compliance check"""
        return """GST Compliance Status:
✅ GST Registration: Active
✅ Invoice Generation: Compliant
✅ GSTR-1 Filing: On Schedule
⚠️ GSTR-3B: Due in 5 days

Recommendations:
1. File GSTR-3B before due date to avoid penalties
2. Ensure all invoices have HSN codes
3. Maintain e-way bill documentation for inter-state sales
4. Quarterly reconciliation of input tax credit"""

# ============================================================================
# CrewAI Integration for Multi-Agent Workflows
# ============================================================================

try:
    from crewai import Agent, Task, Crew, Process
    from crewai.tools import tool

    @tool
    def inventory_analyzer(query: str) -> str:
        """Analyze inventory and provide recommendations"""
        return DukaanMitraAIBrain()._get_inventory_status(query)

    @tool
    def sales_forecaster(query: str) -> str:
        """Forecast sales and demand"""
        return DukaanMitraAIBrain()._analyze_sales_trends(query)

    @tool
    def customer_retention_specialist(query: str) -> str:
        """Provide customer retention strategies"""
        return DukaanMitraAIBrain()._customer_insights(query)

    @tool
    def marketing_content_creator(query: str) -> str:
        """Create marketing content"""
        return DukaanMitraAIBrain()._generate_marketing_copy(query)

    class DukaanMitraCrew:
        """Multi-agent crew for complex business workflows"""

        def __init__(self, api_key: str = None):
            self.api_key = api_key or os.getenv("OPENAI_API_KEY")
            self.llm = ChatOpenAI(api_key=self.api_key, model="gpt-4")

        def create_business_analysis_crew(self) -> Crew:
            """Create a crew for comprehensive business analysis"""

            # Define agents
            inventory_agent = Agent(
                role="Inventory Specialist",
                goal="Optimize inventory levels and reduce waste",
                backstory="You are an expert in retail inventory management with 10 years of experience in Indian kirana stores.",
                tools=[inventory_analyzer],
                llm=self.llm,
                verbose=True
            )

            sales_agent = Agent(
                role="Sales Analyst",
                goal="Analyze sales trends and forecast demand",
                backstory="You specialize in retail sales analytics and demand forecasting for MSMEs.",
                tools=[sales_forecaster],
                llm=self.llm,
                verbose=True
            )

            marketing_agent = Agent(
                role="Marketing Specialist",
                goal="Create effective marketing campaigns for customer engagement",
                backstory="You are a digital marketing expert focused on WhatsApp and social media for local businesses.",
                tools=[marketing_content_creator],
                llm=self.llm,
                verbose=True
            )

            # Define tasks
            inventory_task = Task(
                description="Analyze current inventory status and identify optimization opportunities",
                expected_output="Detailed inventory analysis with actionable recommendations",
                agent=inventory_agent
            )

            sales_task = Task(
                description="Analyze recent sales trends and forecast demand for next month",
                expected_output="Sales trend analysis with demand forecast",
                agent=sales_agent
            )

            marketing_task = Task(
                description="Create marketing campaign based on inventory and sales insights",
                expected_output="Marketing campaign plan with copy and recommendations",
                agent=marketing_agent,
                context=[inventory_task, sales_task]
            )

            # Create crew
            crew = Crew(
                agents=[inventory_agent, sales_agent, marketing_agent],
                tasks=[inventory_task, sales_task, marketing_task],
                process=Process.sequential,
                verbose=True
            )

            return crew

        def run_business_analysis(self) -> str:
            """Run complete business analysis workflow"""
            crew = self.create_business_analysis_crew()
            result = crew.kickoff()
            return str(result)

    CREWAI_AVAILABLE = True
except ImportError:
    CREWAI_AVAILABLE = False
    print("CrewAI not installed. Install with: pip install crewai crewai-tools")

# ============================================================================
# Cloud-Native AI Model Registry
# ============================================================================

class AIModelRegistry:
    """Registry for AI models - cloud-hosted, no local dependencies"""

    MODELS = {
        "gpt-4": {
            "provider": "openai",
            "context_window": 128000,
            "cost_per_1k_tokens": 0.03,
            "best_for": ["complex_analysis", "business_strategy", "content_generation"]
        },
        "gpt-3.5-turbo": {
            "provider": "openai",
            "context_window": 16385,
            "cost_per_1k_tokens": 0.002,
            "best_for": ["quick_queries", "simple_tasks", "chat"]
        },
        "claude-3-opus": {
            "provider": "anthropic",
            "context_window": 200000,
            "cost_per_1k_tokens": 0.015,
            "best_for": ["long_context", "document_analysis", "complex_reasoning"]
        }
    }

    @classmethod
    def get_model_config(cls, model_name: str) -> Dict[str, Any]:
        """Get model configuration"""
        return cls.MODELS.get(model_name, cls.MODELS["gpt-3.5-turbo"])

    @classmethod
    def list_models(cls) -> List[str]:
        """List available models"""
        return list(cls.MODELS.keys())

# ============================================================================
# FastAPI Integration Endpoints
# ============================================================================

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/ai", tags=["ai-brain"])

class AIQueryRequest(BaseModel):
    query: str
    model: str = "gpt-3.5-turbo"
    use_crew: bool = False

class AIQueryResponse(BaseModel):
    response: str
    model_used: str
    processing_time: float

@router.post("/query")
async def query_ai(request: AIQueryRequest) -> AIQueryResponse:
    """Query the AI brain with business question"""

    import time
    start_time = time.time()

    try:
        # Initialize AI brain
        brain = DukaanMitraAIBrain(model=request.model)

        if request.use_crew and CREWAI_AVAILABLE:
            # Use CrewAI for complex workflows
            crew = DukaanMitraCrew()
            response = crew.run_business_analysis()
        else:
            # Use LangChain for single queries
            response = brain.query(request.query)

        processing_time = time.time() - start_time

        return AIQueryResponse(
            response=response,
            model_used=request.model,
            processing_time=processing_time
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models")
async def list_models():
    """List available AI models"""
    return AIModelRegistry.list_models()

@router.get("/models/{model_name}")
async def get_model_info(model_name: str):
    """Get model information"""
    config = AIModelRegistry.get_model_config(model_name)
    if not config:
        raise HTTPException(status_code=404, detail="Model not found")
    return config

# Register routes with main app
def register_ai_routes(app):
    """Register AI brain routes with FastAPI app"""
    app.include_router(router)
