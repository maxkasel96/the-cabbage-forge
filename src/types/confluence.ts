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
  parentId?: string;
  body: {
    storage: ConfluencePageBodyStorage;
  };
  version: ConfluencePageVersion;
}

export interface ConfluencePageCreateRequest {
  spaceId: string;
  status: 'current';
  title: string;
  parentId?: string;
  body: ConfluencePageBodyStorage;
}

export interface ConfluencePageUpdateRequest {
  id: string;
  status: 'current';
  title: string;
  spaceId: string;
  version: ConfluencePageVersion;
  body: ConfluencePageBodyStorage;
}

export interface ConfluencePageCreateResponse {
  id: string;
  title: string;
  spaceId: string;
  parentId?: string;
  version: ConfluencePageVersion;
}

export interface ConfluencePageUpdateResponse {
  id: string;
  title: string;
  spaceId: string;
  version: ConfluencePageVersion;
}

export interface ConfluencePageListResponse {
  results: ConfluencePageReadModel[];
}

export interface EnsureConfluencePageResult {
  page: ConfluencePageReadModel;
  createdPage: boolean;
}
