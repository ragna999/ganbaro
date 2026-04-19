import { NextRequest } from "next/server";
import { nvidia, MODELS } from "@/lib/nvidia";

export const maxDuration = 60;

interface GithubRepo {
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics: string[];
}

interface TreeItem {
  type: string;
  path: string;
}

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname !== "github.com") return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(".git", "") };
  } catch {
    return null;
  }
}

async function ghFetch(path: string) {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Ganbaro-App",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return fetch(`https://api.github.com${path}`, { headers });
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  const parsed = parseGithubUrl(url);
  if (!parsed) {
    return new Response("Invalid GitHub URL", { status: 400 });
  }

  const { owner, repo } = parsed;

  const [repoRes, readmeRes, treeRes] = await Promise.allSettled([
    ghFetch(`/repos/${owner}/${repo}`),
    ghFetch(`/repos/${owner}/${repo}/readme`),
    ghFetch(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=0`),
  ]);

  if (repoRes.status === "rejected") {
    return new Response(`Network error: ${repoRes.reason}`, { status: 500 });
  }
  if (!repoRes.value.ok) {
    const body = await repoRes.value.text();
    console.error(`GitHub API ${repoRes.value.status}:`, body);
    if (repoRes.value.status === 403) {
      return new Response("GitHub API rate limit reached. Set GITHUB_TOKEN in .env.local to fix this.", { status: 429 });
    }
    if (repoRes.value.status === 404) {
      return new Response("Repository not found. Make sure the URL is correct and the repo is public.", { status: 404 });
    }
    return new Response(`GitHub API error ${repoRes.value.status}: ${body}`, { status: 502 });
  }

  const repoData: GithubRepo = await repoRes.value.json();

  const readmeRaw =
    readmeRes.status === "fulfilled" && readmeRes.value.ok
      ? await readmeRes.value.json()
      : null;
  const readmeContent: string | null = readmeRaw?.content
    ? Buffer.from(readmeRaw.content, "base64").toString("utf-8").slice(0, 4000)
    : null;

  const treeData =
    treeRes.status === "fulfilled" && treeRes.value.ok
      ? await treeRes.value.json()
      : null;
  const fileList: string | null = treeData?.tree
    ? (treeData.tree as TreeItem[])
        .filter((f) => f.type === "blob")
        .map((f) => f.path)
        .slice(0, 60)
        .join("\n")
    : null;

  const prompt = `You are a senior software engineer. Analyze this GitHub repository and provide a clear, comprehensive explanation for developers exploring this codebase.

## Repository: ${owner}/${repo}
- **Description:** ${repoData.description ?? "No description provided"}
- **Primary Language:** ${repoData.language ?? "Unknown"}
- **Stars:** ${repoData.stargazers_count.toLocaleString()}
- **Topics:** ${repoData.topics?.length ? repoData.topics.join(", ") : "None"}
${readmeContent ? `\n## README (excerpt)\n${readmeContent}` : ""}
${fileList ? `\n## File Structure\n\`\`\`\n${fileList}\n\`\`\`` : ""}

Provide a structured explanation covering:

1. **What It Does** — Core purpose and the problem it solves
2. **How It Works** — Architecture, key components, and technical approach
3. **Tech Stack** — Languages, frameworks, and libraries used
4. **Getting Started** — How to use or contribute
5. **Notable Insights** — Anything interesting or worth knowing about this codebase

Be developer-friendly, accurate, and concise.`;

  const stream = await nvidia.chat.completions.create({
    model: MODELS.repoExplainer,
    messages: [{ role: "user", content: prompt }],
    stream: true,
    max_tokens: 1500,
    temperature: 0.3,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
