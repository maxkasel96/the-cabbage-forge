export interface ConfluencePageBodyStorage {
  representation: 'storage';
  value: string;
}

export interface ConfluencePageVersion {
  number: number;
}

export interface ConfluencePageReadModel {
  id: string;
  title: string;
  spaceId: string;
  body: {
    storage: ConfluencePageBodyStorage;
  };
  version: ConfluencePageVersion;
}

export interface ConfluencePageUpdateRequest {
  id: string;
  status: 'current';
  title: string;
  spaceId: string;
  version: ConfluencePageVersion;
  body: ConfluencePageBodyStorage;
}

export interface ConfluencePageUpdateResponse {
  id: string;
  title: string;
  spaceId: string;
  version: ConfluencePageVersion;
}
