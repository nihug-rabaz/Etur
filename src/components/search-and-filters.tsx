"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type SearchAndFiltersProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedDomain: string;
  onDomainChange: (value: string) => void;
  selectedTopic: string;
  onTopicChange: (value: string) => void;
  domains: string[];
  topics: string[];
};

export const SearchAndFilters = ({
  searchQuery,
  onSearchChange,
  selectedDomain,
  onDomainChange,
  selectedTopic,
  onTopicChange,
  domains,
  topics,
}: SearchAndFiltersProps) => {
  return (
    <div className="flex flex-wrap gap-2.5 rounded-lg border border-border bg-card/50 backdrop-blur-sm p-3">
      <div className="flex-1 min-w-[200px]">
        <Input
          type="text"
          placeholder="חפש משימות..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-9"
        />
      </div>
      <div className="min-w-[150px]">
        <Select
          value={selectedDomain}
          onChange={(e) => onDomainChange(e.target.value)}
          className="h-9"
        >
          <option value="all">כל התחומים</option>
          {domains.map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </Select>
      </div>
      <div className="min-w-[150px]">
        <Select
          value={selectedTopic}
          onChange={(e) => onTopicChange(e.target.value)}
          className="h-9"
        >
          <option value="all">כל הנושאים</option>
          {topics.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
};
