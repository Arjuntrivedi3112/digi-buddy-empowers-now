import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLE_PROMPTS: Record<string, string> = {
  general: `You are an AdTech learning assistant. Provide a comprehensive yet accessible analysis of the document.`,
  
  qa: `You are a QA Engineer specialist in AdTech. Focus on:
- Testing requirements and test case scenarios
- Edge cases and potential bugs
- Quality gates and acceptance criteria
- Integration points that need testing
- Performance and load testing considerations
- Data validation requirements`,

  backend: `You are a Backend Developer specialist in AdTech. Focus on:
- API design and endpoints needed
- Data models and database schemas
- System architecture and integration points
- Scalability and performance considerations
- Security implementations required
- Third-party service integrations (DSPs, SSPs, etc.)`,

  frontend: `You are a Frontend Developer specialist in AdTech. Focus on:
- UI/UX components needed
- User flows and interactions
- Data display and visualization
- State management requirements
- Responsive design considerations
- Ad rendering and creative display`,

  security: `You are a Security Engineer specialist in AdTech. Focus on:
- Data privacy and GDPR/CCPA compliance
- Authentication and authorization requirements
- Potential vulnerabilities and attack vectors
- Secure data handling for PII and user tracking
- Fraud prevention measures
- Third-party security considerations`,

  product: `You are a Product Manager specialist in AdTech. Focus on:
- Business requirements and objectives
- User stories and acceptance criteria
- Success metrics and KPIs
- Stakeholder impacts
- Timeline and prioritization
- Competitive considerations`,

  adops: `You are an Ad Operations specialist. Focus on:
- Campaign setup requirements
- Targeting and segmentation options
- Trafficking and scheduling considerations
- Reporting and analytics needs
- Optimization opportunities
- Troubleshooting common issues`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileName, fileContent, role = "general" } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const roleContext = ROLE_PROMPTS[role] || ROLE_PROMPTS.general;
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

    const systemPrompt = `${roleContext}

You are analyzing an AdTech document. Your response MUST follow this exact format with proper markdown:

## 📄 Document Overview
**Type:** [Document type - PRD, SRS, Technical Spec, etc.]
**AdTech Domain:** [Where it fits - DSP, SSP, Ad Exchange, DMP, Publisher, etc.]

## 🎯 Executive Summary
[2-3 clear sentences explaining what this document covers and its purpose]

## 🔑 Key Concepts
- **[Concept 1]:** Brief explanation
- **[Concept 2]:** Brief explanation
- **[Concept 3]:** Brief explanation

## 📋 Step-by-Step Action Plan for ${roleLabel}

### Step 1: [Action Title]
**What to do:** [Clear instruction]
**Why it matters:** [Brief explanation of importance]
**Deliverable:** [Expected output]

### Step 2: [Action Title]
**What to do:** [Clear instruction]
**Why it matters:** [Brief explanation of importance]
**Deliverable:** [Expected output]

### Step 3: [Action Title]
**What to do:** [Clear instruction]
**Why it matters:** [Brief explanation of importance]
**Deliverable:** [Expected output]

[Add more steps as needed based on document complexity]

## ⚠️ Key Considerations for ${roleLabel}
- [Important point 1]
- [Important point 2]
- [Important point 3]

## 💡 Pro Tips
- [Actionable tip relevant to this role]
- [Best practice recommendation]

---
*This summary is tailored for a ${roleLabel} perspective. Change roles to see different insights.*

Keep explanations clear, actionable, and focused on what someone in the ${roleLabel} role needs to know.`;

    console.log(`Processing document: ${fileName} for role: ${role}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Analyze this document named "${fileName}" and provide a comprehensive ${roleLabel}-focused analysis with step-by-step procedures:\n\n${fileContent.substring(0, 20000)}` 
          },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to analyze document. Please try again.");
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "Unable to generate summary. Please try again.";

    console.log(`Successfully generated summary for ${fileName}`);

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Summarize error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "An unexpected error occurred. Please try again." 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
