import { UserController } from '../../modules/user/user.controller';
import { UserService } from '../../modules/user/user.service';
import { UserEntity } from '../../modules/user/user.entity';
import { SignupDto } from '../../modules/user/dto/signup.dto';
import type { BasicTokenRequest } from '@interfaces/authenticatedRequest.interface';

describe('UserController', () => {
  const ALLOWED_SCOPES = ['read', 'write'];

  function buildUser(): UserEntity {
    const user = new UserEntity();
    user.id = 'user-1';
    user.clientId = 'client-from-guard';
    user.username = 'alice';
    user.passwordHash = 'stored-bcrypt-hash';
    return user;
  }

  function buildController(user: UserEntity) {
    const signupMock = jest.fn(() =>
      Promise.resolve({ user, allowedScopes: ALLOWED_SCOPES }),
    );
    const userService = { signup: signupMock } as unknown as UserService;
    return { controller: new UserController(userService), signupMock };
  }

  let user: UserEntity;
  let controller: UserController;
  let signupMock: ReturnType<typeof buildController>['signupMock'];
  let request: BasicTokenRequest;
  let dto: SignupDto;

  beforeEach(() => {
    user = buildUser();
    ({ controller, signupMock } = buildController(user));
    request = { clientId: 'client-from-guard' } as unknown as BasicTokenRequest;
    dto = { username: 'alice', password: 'plain-password' };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('takes the clientId from the authenticated request, not from the body (REQ-2.1)', async () => {
    await controller.signup(request, dto);

    expect(signupMock).toHaveBeenCalledWith(
      'client-from-guard',
      'alice',
      'plain-password',
    );
  });

  it('returns the client\'s current allowedScopes as the user\'s scopes (REQ-2.4)', async () => {
    const response = await controller.signup(request, dto);

    expect(response).toMatchObject({
      id: 'user-1',
      username: 'alice',
      scopes: ALLOWED_SCOPES,
    });
  });

  it('never echoes the password or its hash back (REQ-2.3)', async () => {
    const response = await controller.signup(request, dto);

    expect(response).not.toHaveProperty('password');
    expect(response).not.toHaveProperty('passwordHash');
  });
});
