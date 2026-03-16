# Evento System Architecture

The following diagram illustrates the high-level architecture of Evento, highlighting the relationships between the frontend, the agentic backend, and Google Cloud services.

```mermaid
graph TD
    subgraph Client ["Client Layer (Web)"]
        User(["User / Browser"])
        Frontend["React (Vite) Frontend"]
    end

    subgraph Auth ["Authentication"]
        FirebaseAuth["Firebase Auth"]
    end

    subgraph Backend ["Agentic Backend (Python/FastAPI)"]
        API["FastAPI App (REST & WebSockets)"]
        ADK["ADK Orchestrator"]
        StorageSvc["Storage Service (GCS Utils)"]
        DB_Svc["Firestore Service"]
        
        subgraph Agents ["Multi-Agent System (ADK)"]
            Orchestrator["Orchestrator"]
            InfoGatherer["EventInfoGatherer"]
            GenManager["ContentGenerationManager"]
            SubAgents["Research & Planner / Content Generator / Video Gen"]
        end
    end

    subgraph Data ["Data & Storage"]
        Firestore[("Firestore (Meta & Sessions)")]
        GCS[("GCS (Media Assets)")]
    end

    subgraph AI ["AI & Model Layer (Google Cloud)"]
        Gemini["Gemini 2.5 Flash / Pro"]
        ImageGen["gemini-2.5-flash-image"]
        VideoGen["Veo (Video Gen)"]
        AgentEngine["Vertex AI Agent Engine"]
    end

    %% Connections
    User -->|Interacts| Frontend
    Frontend -->|Login/Auth| FirebaseAuth
    Frontend -->|REST/WS| API
    Frontend -.->|Direct Render| GCS

    API -->|Verify Token| FirebaseAuth
    API -->|Manage Sessions| ADK
    API -->|CRUD Events| DB_Svc
    DB_Svc --> Firestore

    ADK --> Orchestrator
    Orchestrator --> InfoGatherer
    Orchestrator --> GenManager
    GenManager --> SubAgents

    SubAgents -->|Generate Text/Images| Gemini
    SubAgents -->|Generate Video| VideoGen
    SubAgents -->|Generate Image| ImageGen
    
    SubAgents -->|Upload Media| StorageSvc
    StorageSvc -->|Store Assets| GCS
    
    ADK -->|Persist Sessions| AgentEngine
```

## Architectural Highlights

- **Multimodal Response Pipeline**: Agents generate native content (text, images, and video) which is intercepted by ADK callbacks, uploaded to Google Cloud Storage, and transformed into a structured JSON response for real-time rendering on the frontend.
- **Agentic Orchestration**: Evento uses the **Agent Development Kit (ADK)** to build a directed acyclic graph (DAG) of specialized agents. This allows for complex, multi-turn reasoning and specialized tool usage (like Google Search grounding).
- **Scalable Media Handling**: By using GCS directly for media assets and bypassing Base64 encoding over WebSockets, Evento ensures high performance and prevents session state bloat.
- **Cloud-Native Integration**: The entire stack is built to be deployed on **Cloud Run**, leveraging **Vertex AI** for industry-leading generative capabilities and **Firebase** for secure, easy-to-manage authentication.
