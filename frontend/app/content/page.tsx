"use client";

import { useEffect, useState } from "react";
import { Heart, MessageSquare, Eye, ExternalLink, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API = "http://localhost:8521";

interface Article {
  id: number;
  title: string;
  description: string;
  url: string;
  published_at: string;
  positive_reactions_count: number;
  comments_count: number;
  page_views_count: number;
  reading_time_minutes: number;
  tag_list: string[];
  published: boolean;
}

interface HNPost {
  objectID: string;
  title: string;
  url: string;
  points: number;
  num_comments: number;
  created_at: string;
  author: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function ContentPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [hnPosts, setHnPosts] = useState<HNPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/articles`).then((r) => r.json()),
      fetch(`${API}/api/hn`).then((r) => r.json()),
    ])
      .then(([artData, hnData]) => {
        setArticles((artData.articles ?? []).sort((a: Article, b: Article) => (b.page_views_count ?? 0) - (a.page_views_count ?? 0)));
        setHnPosts(hnData.posts ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const published = articles.filter((a) => a.published);
  const drafts = articles.filter((a) => !a.published);
  const totalViews = articles.reduce(
    (s, a) => s + (a.page_views_count ?? 0),
    0
  );
  const totalReactions = articles.reduce(
    (s, a) => s + (a.positive_reactions_count ?? 0),
    0
  );

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Content</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Dev.to articles &amp; Hacker News activity
        </p>
        {!loading && articles.length > 0 && (
          <p className="text-xs text-zinc-500 mt-2">
            <span className="text-zinc-300">{totalViews.toLocaleString()}</span> total views
            {" · "}
            <span className="text-zinc-300">{totalReactions}</span> reactions across{" "}
            <span className="text-zinc-300">{articles.length}</span> articles
          </p>
        )}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 bg-zinc-800 rounded-xl" />
            ))
          : articles.length > 0 &&
            [
              { label: "Published", value: published.length },
              { label: "Drafts", value: drafts.length },
              { label: "Total Views", value: totalViews.toLocaleString() },
              { label: "Reactions", value: totalReactions },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"
              >
                <p className="text-xs text-zinc-500 uppercase tracking-wide">
                  {label}
                </p>
                <p className="text-xl font-bold text-zinc-100 mt-1">{value}</p>
              </div>
            ))}
      </div>

      <Tabs defaultValue="devto">
        <TabsList className="bg-zinc-800 border border-zinc-700">
          <TabsTrigger value="devto" className="text-xs">
            Dev.to ({articles.length})
          </TabsTrigger>
          <TabsTrigger value="hn" className="text-xs">
            Hacker News ({hnPosts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devto" className="mt-4 space-y-3">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 bg-zinc-800 rounded-xl" />
              ))
            : articles.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-8">
                No articles found. Is DEVTO_API_KEY set?
              </p>
            ) : (
              articles.map((article) => (
                <Card
                  key={article.id}
                  className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <CardContent className="pt-4 pb-4 px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] py-0 ${
                              article.published
                                ? "border-green-700 text-green-400"
                                : "border-yellow-700 text-yellow-500"
                            }`}
                          >
                            {article.published ? "published" : "draft"}
                          </Badge>
                          <span className="text-xs text-zinc-600">
                            {timeAgo(article.published_at)}
                          </span>
                        </div>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-zinc-200 hover:text-violet-300 transition-colors line-clamp-1"
                        >
                          {article.title}
                        </a>
                        {article.description && (
                          <p className="text-xs text-zinc-500 mt-1 line-clamp-1">
                            {article.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2">
                          <span className="flex items-center gap-1 text-xs text-zinc-500">
                            <Heart className="w-3 h-3" />
                            {article.positive_reactions_count}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-zinc-500">
                            <MessageSquare className="w-3 h-3" />
                            {article.comments_count}
                          </span>
                          {article.page_views_count > 0 && (
                            <span className="flex items-center gap-1 text-xs text-zinc-500">
                              <Eye className="w-3 h-3" />
                              {article.page_views_count.toLocaleString()}
                            </span>
                          )}
                          {article.tag_list?.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] text-violet-500"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-600 hover:text-zinc-400 shrink-0 mt-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
        </TabsContent>

        <TabsContent value="hn" className="mt-4 space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 bg-zinc-800 rounded-xl" />
            ))
          ) : hnPosts.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">
              No Hacker News results found
            </p>
          ) : (
            hnPosts.map((post, i) => (
              <div
                key={post.objectID}
                className="flex items-center gap-4 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
              >
                <span className="text-sm font-bold text-zinc-600 w-5 shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <a
                    href={
                      post.url ||
                      `https://news.ycombinator.com/item?id=${post.objectID}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-zinc-200 hover:text-violet-300 transition-colors line-clamp-1"
                  >
                    {post.title}
                  </a>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-orange-400">
                      <TrendingUp className="w-3 h-3" />
                      {post.points} pts
                    </span>
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <MessageSquare className="w-3 h-3" />
                      {post.num_comments}
                    </span>
                    <span className="text-xs text-zinc-600">
                      by {post.author}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {timeAgo(post.created_at)}
                    </span>
                  </div>
                </div>
                <a
                  href={`https://news.ycombinator.com/item?id=${post.objectID}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-600 hover:text-zinc-400 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
