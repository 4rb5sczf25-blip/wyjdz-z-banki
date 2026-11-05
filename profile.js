function profileName(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\s+/gu, ' ').trim().slice(0, 40);
}
async function saveProfileName(value) {
  const session = sbSession();
  if (!session || isGuestSession(session)) throw new Error('Zaloguj się, aby zapisać imię lub nick.');
  if (typeof value !== 'string' || value.trim().length > 40) throw new Error('Imię lub nick może mieć najwyżej 40 znaków.');
  const name = profileName(value);
  const token = await sbToken();
  if (!token) throw new Error('Sesja wygasła. Zaloguj się ponownie.');
  const user = await sbReq('/auth/v1/user', { method: 'PUT', token, body: { data: { display_name: name } } });
  if (user?.id !== session.uid || sbSession()?.uid !== session.uid) throw new Error('Sesja zmieniła się. Spróbuj ponownie.');
  sbStore({ ...sbSession(), displayName: profileName(user.user_metadata?.display_name) });
}
