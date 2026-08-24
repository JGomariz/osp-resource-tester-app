import { describe, expect, it } from "vitest";
import type { SendOutcome } from "./sendFlow";
import {
  responseViewFor,
  createResponseViewState,
  detectBodyKind,
  displayedText,
  matchCounter,
  matches,
  nextMatch,
  previousMatch,
  setMode,
  setQuery,
} from "./responseView";

describe("detectBodyKind", () => {
  it("recognises a JSON object and a JSON array", () => {
    expect(detectBodyKind('{"lines":[]}')).toBe("json");
    expect(detectBodyKind("[1, 2, 3]")).toBe("json");
    expect(detectBodyKind('\n  {"a":1}\n')).toBe("json");
  });

  it("recognises XML, with or without a declaration", () => {
    expect(detectBodyKind("<lines><line/></lines>")).toBe("xml");
    expect(detectBodyKind('<?xml version="1.0"?><lines/>')).toBe("xml");
  });

  it("calls anything it cannot parse plain text", () => {
    expect(detectBodyKind("")).toBe("text");
    expect(detectBodyKind("   ")).toBe("text");
    expect(detectBodyKind("Internal Server Error")).toBe("text");
    expect(detectBodyKind('{"truncated": ')).toBe("text");
    expect(detectBodyKind("<unclosed")).toBe("text");
  });

  it("does not treat a bare JSON scalar as formattable JSON", () => {
    expect(detectBodyKind("42")).toBe("text");
    expect(detectBodyKind('"just a string"')).toBe("text");
  });
});

/** The text on screen for a body in Pretty mode, which is the default. */
function pretty(body: string): string {
  return displayedText(createResponseViewState(body));
}

describe("Pretty mode", () => {
  it("indents JSON two spaces per level", () => {
    expect(pretty('{"lines":[{"id":1,"status":"active"}],"total":1}')).toBe(
      [
        "{",
        '  "lines": [',
        "    {",
        '      "id": 1,',
        '      "status": "active"',
        "    }",
        "  ],",
        '  "total": 1',
        "}",
      ].join("\n"),
    );
  });

  it("indents XML one level per open element, keeping text with its element", () => {
    expect(
      pretty("<lines><line><id>1</id><status>active</status></line></lines>"),
    ).toBe(
      [
        "<lines>",
        "  <line>",
        "    <id>1</id>",
        "    <status>active</status>",
        "  </line>",
        "</lines>",
      ].join("\n"),
    );
  });

  it("keeps a declaration and self-closing elements at their own level", () => {
    expect(pretty('<?xml version="1.0"?><lines><line id="1"/></lines>')).toBe(
      ['<?xml version="1.0"?>', "<lines>", '  <line id="1"/>', "</lines>"].join(
        "\n",
      ),
    );
  });

  it("indents a namespaced SOAP envelope, declaration and all", () => {
    expect(
      pretty(
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<soap:Envelope xmlns:soap="x"><soap:Body><f>1</f></soap:Body></soap:Envelope>',
      ),
    ).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<soap:Envelope xmlns:soap="x">',
        "  <soap:Body>",
        "    <f>1</f>",
        "  </soap:Body>",
        "</soap:Envelope>",
      ].join("\n"),
    );
  });

  it("shows a body it cannot recognise as the text it is", () => {
    expect(pretty("Internal Server Error")).toBe("Internal Server Error");
    expect(pretty('{"truncated": ')).toBe('{"truncated": ');
    expect(pretty("")).toBe("");
  });
});

describe("Raw mode", () => {
  it("shows the body exactly as received, formatting nothing", () => {
    const body = '{"lines":[{"id":1}]}';

    expect(displayedText(setMode(createResponseViewState(body), "raw"))).toBe(
      body,
    );
  });
});

describe("responseViewFor", () => {
  const response = (body: string): SendOutcome => ({
    kind: "response",
    status: 200,
    durationMs: 5,
    body,
    token: null,
  });

  it("opens a viewer on the body that came back", () => {
    const state = responseViewFor(response('{"a":1}'), null);

    expect(state?.body).toBe('{"a":1}');
    expect(state?.mode).toBe("pretty");
  });

  it("keeps the chosen mode and search across sends, since both are the user's", () => {
    let previous = setMode(createResponseViewState("old"), "raw");
    previous = nextMatch(setQuery(previous, "o"));

    const state = responseViewFor(response("nuevo cuerpo"), previous);

    expect(state?.mode).toBe("raw");
    expect(state?.query).toBe("o");
    // Offsets belonged to the old body, so the highlight starts over.
    expect(state?.activeMatch).toBe(0);
  });

  it("offers a viewer for a token failure, whose body is worth reading too", () => {
    const outcome: SendOutcome = {
      kind: "token-failure",
      status: 401,
      durationMs: 5,
      body: '{"fault":"bad creds"}',
    };

    expect(responseViewFor(outcome, null)?.body).toBe('{"fault":"bad creds"}');
  });

  it("has nothing to show without a response, or when none arrived", () => {
    expect(responseViewFor(null, null)).toBeNull();
    expect(
      responseViewFor(
        {
          kind: "network-error",
          failure: {
            kind: "unreachable",
            message: "No se pudo localizar el servidor.",
            detail: "dns error",
          },
          token: null,
        },
        null,
      ),
    ).toBeNull();
  });
});

describe("searching the response", () => {
  const searched = (body: string, query: string) =>
    setQuery(createResponseViewState(body), query);

  it("finds every occurrence, whatever its case", () => {
    const state = setQuery(
      setMode(createResponseViewState("Status: ACTIVE, status: active"), "raw"),
      "status",
    );

    // "Status: ACTIVE, " is 16 characters, so the second match starts there.
    expect(matches(state)).toEqual([
      { start: 0, end: 6 },
      { start: 16, end: 22 },
    ]);
  });

  it("finds nothing while the search field is empty", () => {
    const state = searched('{"a":1}', "");

    expect(matches(state)).toEqual([]);
    expect(matchCounter(state)).toBeNull();
  });

  it("counts matches in Spanish, one-based", () => {
    const state = searched("uno dos uno tres uno", "uno");

    expect(matchCounter(state)).toBe("1 de 3");
    expect(matchCounter(nextMatch(state))).toBe("2 de 3");
  });

  it("says so plainly when the search finds nothing", () => {
    expect(matchCounter(searched("uno dos", "cuatro"))).toBe("Sin resultados");
  });

  it("wraps around at both ends", () => {
    const state = searched("uno uno uno", "uno");
    const last = nextMatch(nextMatch(state));

    expect(matchCounter(nextMatch(last))).toBe("1 de 3");
    expect(matchCounter(previousMatch(state))).toBe("3 de 3");
  });

  it("returns to the first match when the query changes", () => {
    const state = nextMatch(searched("uno uno uno", "uno"));

    expect(matchCounter(setQuery(state, "uno"))).toBe("1 de 3");
  });

  it("searches the text actually on screen, so Pretty and Raw agree with it", () => {
    const body = '{"lines":[{"status":"active"}]}';
    const raw = setQuery(setMode(createResponseViewState(body), "raw"), '"status":');
    const prettied = setQuery(createResponseViewState(body), '"status": ');

    expect(matchCounter(raw)).toBe("1 de 1");
    expect(matchCounter(prettied)).toBe("1 de 1");
    // The pretty text inserts a space after the colon, which is why the query
    // that matches on screen differs between the two views.
    expect(matchCounter(setQuery(prettied, '"status":"'))).toBe(
      "Sin resultados",
    );
  });

  it("does not overlap matches", () => {
    expect(matches(searched("aaaa", "aa"))).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
  });
});
