import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import type { ResponseViewState } from "../engine";
import { displayedText, matches } from "../engine";

interface ResponseBodyProps {
  view: ResponseViewState;
}

/**
 * The response text with every match highlighted. Offsets come from the engine
 * and index into the displayed text, so highlighting works the same in Pretty
 * and Raw.
 */
export function ResponseBody({ view }: ResponseBodyProps) {
  const text = displayedText(view);
  const found = matches(view);
  const activeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center" });
  }, [view.activeMatch, view.query, view.mode]);

  if (found.length === 0) {
    return <pre className="response-body">{text}</pre>;
  }

  const pieces: ReactNode[] = [];
  let at = 0;
  found.forEach((match, index) => {
    if (match.start > at) pieces.push(text.slice(at, match.start));
    const isActive = index === view.activeMatch;
    pieces.push(
      <mark
        key={match.start}
        className={isActive ? "match is-active" : "match"}
        ref={isActive ? activeRef : null}
      >
        {text.slice(match.start, match.end)}
      </mark>,
    );
    at = match.end;
  });
  if (at < text.length) pieces.push(text.slice(at));

  return <pre className="response-body">{pieces}</pre>;
}
