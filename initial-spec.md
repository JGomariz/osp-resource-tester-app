## Resource tester app
This app is designed to test the resource availability in backend services for non-production environments. This is done by http requests to the backend services. The final app should be a single executable for windows and mac.

### Requirements
-  Global design with MasOrange palette.
- Have a side panel for the list of backend services (collapsible items).
- The first tree should have this data:
  - CRMB2B
    - Lines
    - Customer Products
    - ServiciosCentrex
  - MDG
  - Line Usage B2B
  - Customer View B2B
  - Eunomia
  - Excalibur
  - Profiler
- The main panel should have a header panel with fields to input data:
  - A dropdown to select the environment: ent1, ent2, ase.
  - A Text field to input the Document ID.
  - A Read-only text field (with different colors for each case) to show if the backend is reached via zuul or apigee.
    - The backend is reached via zuul if the url starts with "https://zuul.".
    - The backend is reached via apigee if the url starts with "https://api-".
  - Extra text fields or dropdowns will be visible depending on the specific request to add or remove request query params.  
  - An editable field to show the final url to call.
  - A button to send the request.
- In the main panel below the header panel:
  - Should show the response from the backend.
  - The response should be displayed in a scrollable panel.
  - It should have a search field to find specific strings in the response and highlight them.
  - The panel should have a style selector for the response, pretty (json, xml) and raw. 
- Url composition:
  - The template for apigee request should be: https://api-{{env}}-openapi.cloudready-nonprod.cloud.si.orange.es/jwt. Where {{env}} is the selected environment.
  - Before each apigee request, a token should be generated and added to the request header with this format: Authorization: {{token}}.
  - The token should be generated using the following url: ~~https://api-{{env}}-openapi.cloudready-nonprod.cloud.si.orange.es/token~~ **corrected 2026-08-24: https://api-{{env}}-openapi.cloudready-nonprod.cloud.si.orange.es/jwtgenerator/v1/token**. Where {{env}} is the selected environment. (The original path returned 404 with an empty body from Apigee — nothing was deployed at that basepath. Struck through rather than replaced so the record of what was originally specified survives.)
    - The headers in the token request should be:
        x-forwarded-server:areaclientes.si.orange.es
        service:PAE
        accept:application/json
        Content-Type:application/json
        z-document:{{Content of the Document ID input text field }}
        z-logintype:DOCID
        z-login:{{Content of the Document ID input text field }}
        z-brand:orange
        x-wassup-lra:MassMarketMobileUser,MassMarketFixUser
    - The response has a field called "Token-JWT" that should be used as the token value.
  - The template for zuul requests is: https://zuul-uat2.int.si.orange.es:9061 for ent1, https://zuul-uat.int.si.orange.es:9061 for ent2 and https://zuul-ase.int.si.orange.es:9061 for ase.

## Requests:
- CRMB2B
    - Lines: 
      - GET {{base url}}/crbproductinventory/v1/lines?docId={{DocumentId}}&productType={{productType}}&status={{status}}
      - {{DocumentId}} = Text from Document ID input text field.
      - {{productType}} = Specific Dropdown: fixed, mobile or empty (should remove the queryParam name from the request if empty).
      - {{status}} = active, inactive or empty (should remove the queryParam name from the request if empty).