import type { Repository } from 'typeorm';
import { ClientRepository } from '../client/client.repository';
import { OidcModelEntity } from './oidc.entity';
import { CLIENT_GRANT_TYPES } from './oidc.constants';

export class OidcAdapter {
  constructor(
    private readonly modelName: string,
    private readonly oidcModelRepository: Repository<OidcModelEntity>,
    private readonly clientRepository: ClientRepository,
  ) { }

  async upsert(
    id: string,
    payload: Record<string, unknown>,
    expiresIn: number,
  ): Promise<void> {
    if (this.modelName === 'Client') {
      return;
    }

    const entity = new OidcModelEntity();
    entity.id = id;
    entity.modelName = this.modelName;
    entity.payload = payload;
    entity.grantId = payload.grantId as string | undefined;
    entity.userCode = payload.userCode as string | undefined;
    entity.uid = payload.uid as string | undefined;
    entity.expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : undefined;
    await this.oidcModelRepository.save(entity);
  }

  async find(id: string): Promise<Record<string, unknown> | undefined> {
    if (this.modelName === 'Client') {
      const client = await this.clientRepository.findByClientId(id);
      if (!client) return undefined;
      return {
        client_id: client.id,
        client_secret: client.clientSecret,
        grant_types: [...CLIENT_GRANT_TYPES],
        redirect_uris: [],
        response_types: [],
        scope: client.allowedScopes.join(' '),
        token_endpoint_auth_method: 'client_secret_basic',
      };
    }

    const entity = await this.oidcModelRepository.findOneBy({
      id,
      modelName: this.modelName,
    });
    if (!entity) return undefined;
    if (entity.consumedAt) {
      return {
        ...entity.payload,
        consumed: Math.floor(entity.consumedAt.getTime() / 1000),
      };
    }
    return entity.payload;
  }

  async findByUserCode(
    userCode: string,
  ): Promise<Record<string, unknown> | undefined> {
    const entity = await this.oidcModelRepository.findOneBy({
      userCode,
      modelName: this.modelName,
    });
    return entity?.payload;
  }

  async findByUid(uid: string): Promise<Record<string, unknown> | undefined> {
    const entity = await this.oidcModelRepository.findOneBy({
      uid,
      modelName: this.modelName,
    });
    return entity?.payload;
  }

  async consume(id: string): Promise<void> {
    await this.oidcModelRepository.update(
      { id, modelName: this.modelName },
      { consumedAt: new Date() },
    );
  }

  async destroy(id: string): Promise<void> {
    await this.oidcModelRepository.delete({ id, modelName: this.modelName });
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    await this.oidcModelRepository.delete({ grantId });
  }
}
