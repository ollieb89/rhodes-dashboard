import { render, screen, waitFor } from "@testing-library/react";
import OverviewPage from "@/app/page";

// Mock Next.js navigation (Link renders fine in jsdom; usePathname not used here)
vi.mock("next/link", () => ({
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const OVERVIEW_DATA = {
  stats: {
    total_repos: 10,
    total_articles: 5,
    total_agents: 3,
    last_updated: new Date().toISOString(),
  },
};

const PRODUCTS_DATA = {
  repos: [
    {
      name: "my-repo",
      description: "A test repo",
      stargazerCount: 42,
      forkCount: 3,
      createdAt: new Date().toISOString(),
      url: "https://github.com/test/my-repo",
    },
  ],
};

const AGENTS_DATA = {
  agents: [
    { id: "a1", name: "Agent One", status: "active", schedule: "*/5 * * * *", last_run: null, next_run: null },
    { id: "a2", name: "Agent Two", status: "paused", schedule: "0 * * * *", last_run: null, next_run: null },
  ],
};

function mockFetchSuccess() {
  (global.fetch as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce({ ok: true, json: async () => OVERVIEW_DATA } as any)
    .mockResolvedValueOnce({ ok: true, json: async () => PRODUCTS_DATA } as any)
    .mockResolvedValueOnce({ ok: true, json: async () => AGENTS_DATA } as any);
}

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OverviewPage", () => {
  it("renders loading skeletons before data loads", () => {
    // fetch never resolves during this synchronous check
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<OverviewPage />);

    // Stat card labels are absent while loading
    expect(screen.queryByText("Repositories")).not.toBeInTheDocument();
    expect(screen.queryByText("Articles")).not.toBeInTheDocument();
    expect(screen.queryByText("Cron Agents")).not.toBeInTheDocument();
  });

  it("renders stat cards after data loads", async () => {
    mockFetchSuccess();
    render(<OverviewPage />);

    await screen.findByText("Repositories");
    expect(screen.getByText("Articles")).toBeInTheDocument();
    expect(screen.getByText("Cron Agents")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows correct stat values from API response", async () => {
    mockFetchSuccess();
    render(<OverviewPage />);

    await screen.findByText("10"); // total_repos
    expect(screen.getByText("5")).toBeInTheDocument(); // total_articles
    expect(screen.getByText("3")).toBeInTheDocument(); // total_agents
  });

  it("shows N of M agents active summary", async () => {
    mockFetchSuccess();
    render(<OverviewPage />);

    // 1 of 2 agents is active in AGENTS_DATA
    await screen.findByText(/1 of 2 agents active/i);
  });

  it("shows Offline badge when fetch fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
    render(<OverviewPage />);

    await screen.findByText("Offline");
  });

  it("renders repo name after data loads", async () => {
    mockFetchSuccess();
    render(<OverviewPage />);

    await screen.findByText("my-repo");
  });
});
