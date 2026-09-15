import logging
import re


logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------
# AI closed captions
# --------------------------------------------------------------------------

_CAPTION_LANG_RE = re.compile(r"^[A-Za-z0-9-]{2,20}$")
MAX_CAPTION_LANGUAGES = 15


## 🔒 RBAC Utils ##
