export const IS_PUBLIC_KEY = "isPublic";

export const Public = (): ClassDecorator & MethodDecorator => {
  return (target: any, _key?: any, _descriptor?: any) => {
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, target);
    return target;
  };
};

export const RequirePerms = (..._permissions: string[]): MethodDecorator => {
  return () => {};
};

export const RequirePermsAny = (..._permissions: string[]): MethodDecorator => {
  return () => {};
};

export const AccessGuard = jest.fn().mockImplementation(() => ({
  canActivate: jest.fn().mockReturnValue(true),
}));

export const PermissionGuard = jest.fn().mockImplementation(() => ({
  canActivate: jest.fn().mockReturnValue(true),
}));

export const CurrentUser = (): ParameterDecorator => {
  return () => {};
};
