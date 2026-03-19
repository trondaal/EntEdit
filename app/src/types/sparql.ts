export interface SparqlEndpointConfig {
  url: string;
  username?: string;
  password?: string;
}

export interface SparqlBinding {
  type: "uri" | "literal" | "bnode";
  value: string;
  "xml:lang"?: string;
  datatype?: string;
}

export interface SparqlResult {
  [key: string]: SparqlBinding;
}

export interface SparqlResponse {
  head: {
    vars: string[];
  };
  results: {
    bindings: SparqlResult[];
  };
}

export interface RdfClass {
  uri: string;
  label?: string;
  comment?: string;
}

export interface RdfProperty {
  uri: string;
  label?: string;
  comment?: string;
  domain?: string;
  range?: string;
  datatype?: string;
  status?: string;
  order?: number;
}

export interface OrderedValue {
  value: string;
  order: number;
  isUri?: boolean;
}

export interface EntityData {
  uri: string;
  type: string;
  properties: Record<string, string | string[]>;
}
