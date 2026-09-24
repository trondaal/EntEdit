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
  /**
   * Whether the property's values are natural language, and so can carry a
   * language tag (`entedit:linguistic`). A property with no annotation counts
   * as linguistic; dates, numbering and measurements are marked false.
   */
  linguistic?: boolean;
}

export interface OrderedValue {
  value: string;
  order: number;
  isUri?: boolean;
  /** Language tag of a literal value, if it has one. */
  lang?: string;
  /** Datatype IRI of a typed literal (xsd:string is left implicit). */
  datatype?: string;
  /**
   * True when the statement is only inferred by the reasoner. Such values are
   * shown read-only and never written back, so inference is not materialized.
   */
  inferred?: boolean;
}
