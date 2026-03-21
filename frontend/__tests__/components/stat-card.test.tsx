import { render, screen } from "@testing-library/react";
import { Activity } from "lucide-react";
import { StatCard } from "@/components/stat-card";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Total Agents" value={42} icon={Activity} />);
    expect(screen.getByText("Total Agents")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders sub text when provided", () => {
    render(
      <StatCard label="Revenue" value="$100" icon={Activity} sub="this month" />
    );
    expect(screen.getByText("this month")).toBeInTheDocument();
  });

  it("does not render sub text when omitted", () => {
    render(<StatCard label="Count" value={5} icon={Activity} />);
    expect(screen.queryByText("this month")).not.toBeInTheDocument();
  });
});
