"use client";

import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickAddBarProps {
  onAdd: (title: string) => void;
  isAdding?: boolean;
}

export interface QuickAddBarRef {
  focus: () => void;
}

export const QuickAddBar = forwardRef<QuickAddBarRef, QuickAddBarProps>(
  function QuickAddBar({ onAdd, isAdding }, ref) {
    const [input, setInput] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    function handleSubmit() {
      const value = input.trim();
      if (!value) return;
      onAdd(value);
      setInput("");
      inputRef.current?.focus();
    }

    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Name a new topic..."
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-base sm:text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary"
        />
        <Button
          size="icon"
          className="h-10 w-10"
          disabled={!input.trim() || isAdding}
          onClick={handleSubmit}
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }
);
