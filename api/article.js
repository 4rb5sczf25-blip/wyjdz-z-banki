import { authorize } from '../server/access.js';
import { articleURL, fetchArticle } from '../server/article.js';
import { prepare, readBody, fail } from '../server/policy.js';

export function makeHandler({ access = authorize, extract = fetchArticle } = {}) {
  return async function handler(req, res) {
    try {
      prepare(req, res);
      const { url } = readBody(req);
      const normalized = articleURL(url);
      await access(req, 'article');
      return res.status(200).json(await extract(normalized.href));
    } catch (error) { return fail(res, error); }
  };
}
export default makeHandler();
