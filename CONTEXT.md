# Resource Tester

A desktop tool for checking that backend resources respond correctly in non-production environments, by composing and sending HTTP requests against them.

## Language

**Resource**:
A callable backend endpoint — a leaf in the side-panel tree and the unit under test. A Resource may be *undefined* (listed in the tree but with no request specification yet).
_Avoid_: endpoint, request type

**Service**:
A grouping node in the tree that contains Resources. A Service has no endpoint of its own.
_Avoid_: backend, system

**Catalog**:
The configuration that defines the tree of Services and Resources and each Resource's request specification (method, path, query params, Gateway). Bundled with a default; overridable without rebuilding the app.
_Avoid_: tree data, service list

**Environment**:
One of the non-production deployment targets a request is aimed at: `ent1`, `ent2`, or `ase`.
_Avoid_: env (in prose), stage

**Gateway**:
The routing layer a Resource is fixed to — Zuul or Apigee. Each Resource declares exactly one Gateway in the Catalog; the UI indicator is derived from the final URL prefix, never stored.
_Avoid_: proxy, router

**Document ID**:
The customer document identifier typed by the user. Feeds token generation (`z-document`, `z-login`) and Resource query params (`docId`).
_Avoid_: DNI, NIF, login

**Token**:
The JWT obtained from the Apigee token endpoint (`Token-JWT` field of its response), generated fresh before every Apigee request and sent as the `Authorization` header. Zuul requests carry no Token.
_Avoid_: credential, auth key
