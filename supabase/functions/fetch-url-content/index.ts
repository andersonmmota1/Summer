import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Fetch content from the provided URL
    const response = await fetch(url);

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch URL: ${response.statusText}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      });
    }

    const contentType = response.headers.get('Content-Type') || 'text/plain';
    let content;

    // Attempt to read as text, but handle potential binary content gracefully
    try {
      content = await response.text();
    } catch (e) {
      console.error("Error reading response as text, might be binary:", e);
      content = "Content could not be read as text.";
    }

    return new Response(JSON.stringify({ content, contentType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});