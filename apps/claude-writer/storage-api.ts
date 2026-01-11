interface StorageAPI {
  get(
    key: string,
    shared?: boolean,
  ): Promise<{
    key: string;
    value: string;
    shared: boolean;
  } | null>;

  set(
    key: string,
    value: string,
    shared?: boolean,
  ): Promise<{
    key: string;
    value: string;
    shared: boolean;
  } | null>;

  delete(
    key: string,
    shared?: boolean,
  ): Promise<{
    key: string;
    deleted: boolean;
    shared: boolean;
  } | null>;

  list(
    prefix?: string,
    shared?: boolean,
  ): Promise<{
    keys: string[];
    prefix?: string;
    shared: boolean;
  } | null>;
}

declare global {
  interface Window {
    storage: StorageAPI;
  }
}
