var Component = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:process.env>
  var init_define_process_env = __esm({
    "<define:process.env>"() {
    }
  });

  // global-externals:react/jsx-runtime
  var require_jsx_runtime = __commonJS({
    "global-externals:react/jsx-runtime"(exports, module) {
      init_define_process_env();
      module.exports = _jsx_runtime;
    }
  });

  // _mdx_bundler_entry_point-_random_uuid_.mdx
  var mdx_bundler_entry_point__random_uuid__exports = {};
  __export(mdx_bundler_entry_point__random_uuid__exports, {
    Aside: () => Aside,
    default: () => MDXContent,
    frontmatter: () => frontmatter
  });
  init_define_process_env();
  var import_jsx_runtime = __toESM(require_jsx_runtime());

  // global-externals:@mdx-js/react
  init_define_process_env();
  var { useMDXComponents } = MdxJsReact;

  // _mdx_bundler_entry_point-_random_uuid_.mdx
  var frontmatter = {
    "title": "Cards",
    "description": "Use cards to display content in a box"
  };
  function AsideComponent() {
    const { ErrorBoundary, CodeGroup, CodeBlock } = MdxJsReact.useMDXComponents();
    return (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, {
      children: (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsxs)(CodeGroup, {
          children: [(0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(CodeBlock, {
              title: "Basic",
              code: `<Card
  title="Python"
  icon="brands python"
  href="https://github.com/fern-api/fern/tree/main/generators/python"
>
  View Fern's Python SDK generator.
</Card>
`,
              className: "language-jsx",
              language: "jsx"
            })
          }), (0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(CodeBlock, {
              title: "Custom Icon",
              code: `<Card
  title="Python"
  icon={
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/c/c3/Python-logo-notext.svg"
      alt="Python logo"
    />
  }
  href="https://github.com/fern-api/fern/tree/main/generators/python"
>
  View Fern's Python SDK generator.
</Card>
`,
              className: "language-jsx",
              language: "jsx"
            })
          }), (0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(CodeBlock, {
              title: "Icon Position",
              code: '<Card title="Location" icon="regular globe" iconPosition="left">\n  You can set the icon position as `left` or `top`. Default is `top`.\n</Card>\n',
              className: "language-jsx",
              language: "jsx"
            })
          })]
        })
      })
    });
  }
  var Aside = AsideComponent;
  function _createMdxContent(props) {
    const _components = {
      a: "a",
      code: "code",
      h2: "h2",
      h3: "h3",
      img: "img",
      p: "p",
      table: "table",
      tbody: "tbody",
      td: "td",
      th: "th",
      thead: "thead",
      tr: "tr",
      ...useMDXComponents(),
      ...props.components
    }, { Card, CardGroup, ErrorBoundary } = _components;
    if (!Card) _missingMdxReference("Card", true);
    if (!CardGroup) _missingMdxReference("CardGroup", true);
    if (!ErrorBoundary) _missingMdxReference("ErrorBoundary", true);
    return (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
      children: [(0, import_jsx_runtime.jsx)(_components.p, {
        children: "Cards are container components that group related content and actions together. They provide a flexible way to present information with optional elements like icons, titles, and links in a visually distinct box."
      }), "\n", (0, import_jsx_runtime.jsx)(_components.h2, {
        id: "properties",
        children: "Properties"
      }), "\n", (0, import_jsx_runtime.jsxs)(_components.table, {
        children: [(0, import_jsx_runtime.jsx)(_components.thead, {
          children: (0, import_jsx_runtime.jsxs)(_components.tr, {
            children: [(0, import_jsx_runtime.jsx)(_components.th, {
              children: "Property"
            }), (0, import_jsx_runtime.jsx)(_components.th, {
              children: "Type"
            }), (0, import_jsx_runtime.jsx)(_components.th, {
              children: "Description"
            })]
          })
        }), (0, import_jsx_runtime.jsxs)(_components.tbody, {
          children: [(0, import_jsx_runtime.jsxs)(_components.tr, {
            children: [(0, import_jsx_runtime.jsx)(_components.td, {
              children: (0, import_jsx_runtime.jsx)(_components.code, {
                children: "title"
              })
            }), (0, import_jsx_runtime.jsx)(_components.td, {
              children: (0, import_jsx_runtime.jsx)(_components.code, {
                children: "string"
              })
            }), (0, import_jsx_runtime.jsx)(_components.td, {
              children: "The title text to display in the card"
            })]
          }), (0, import_jsx_runtime.jsxs)(_components.tr, {
            children: [(0, import_jsx_runtime.jsx)(_components.td, {
              children: (0, import_jsx_runtime.jsx)(_components.code, {
                children: "icon"
              })
            }), (0, import_jsx_runtime.jsx)(_components.td, {
              children: (0, import_jsx_runtime.jsx)(_components.code, {
                children: "string | img"
              })
            }), (0, import_jsx_runtime.jsxs)(_components.td, {
              children: ["Either a ", (0, import_jsx_runtime.jsx)(_components.a, {
                href: "https://fontawesome.com/icons",
                children: "Font Awesome"
              }), " icon class (e.g. \u2018brands python\u2019) or a custom image"]
            })]
          }), (0, import_jsx_runtime.jsxs)(_components.tr, {
            children: [(0, import_jsx_runtime.jsx)(_components.td, {
              children: (0, import_jsx_runtime.jsx)(_components.code, {
                children: "href"
              })
            }), (0, import_jsx_runtime.jsx)(_components.td, {
              children: (0, import_jsx_runtime.jsx)(_components.code, {
                children: "string"
              })
            }), (0, import_jsx_runtime.jsx)(_components.td, {
              children: "Optional URL that makes the entire card clickable"
            })]
          })]
        })]
      }), "\n", (0, import_jsx_runtime.jsx)(_components.h3, {
        id: "basic",
        children: "Basic"
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CardGroup, {
          children: (0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(Card, {
              title: "Python",
              icon: '<svg data-prefix="fab" data-icon="python" class="svg-inline--fa fa-python" role="img" viewBox="0 0 448 512" aria-hidden="true" width="100%" height="100%"><defs><style>.fa-secondary{opacity:.4}</style></defs><path fill="currentColor" d="M439.8 200.5c-7.7-30.9-22.3-54.2-53.4-54.2l-40.1 0 0 47.4c0 36.8-31.2 67.8-66.8 67.8l-106.8 0c-29.2 0-53.4 25-53.4 54.3l0 101.8c0 29 25.2 46 53.4 54.3 33.8 9.9 66.3 11.7 106.8 0 26.9-7.8 53.4-23.5 53.4-54.3l0-40.7-106.7 0 0-13.6 160.2 0c31.1 0 42.6-21.7 53.4-54.2 11.2-33.5 10.7-65.7 0-108.6zM286.2 444.7a20.4 20.4 0 1 1 0-40.7 20.4 20.4 0 1 1 0 40.7zM167.8 248.1l106.8 0c29.7 0 53.4-24.5 53.4-54.3l0-101.9c0-29-24.4-50.7-53.4-55.6-35.8-5.9-74.7-5.6-106.8 .1-45.2 8-53.4 24.7-53.4 55.6l0 40.7 106.9 0 0 13.6-147 0c-31.1 0-58.3 18.7-66.8 54.2-9.8 40.7-10.2 66.1 0 108.6 7.6 31.6 25.7 54.2 56.8 54.2l36.7 0 0-48.8c0-35.3 30.5-66.4 66.8-66.4zM161.2 64.7a20.4 20.4 0 1 1 0 40.8 20.4 20.4 0 1 1 0-40.8z" /></svg>',
              href: "https://github.com/fern-api/fern/tree/main/generators/python",
              children: (0, import_jsx_runtime.jsx)(_components.p, {
                children: "The icon field references a Font Awesome icon."
              })
            })
          })
        })
      }), "\n", (0, import_jsx_runtime.jsx)(_components.h3, {
        id: "custom-icon",
        children: "Custom icon"
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CardGroup, {
          children: (0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(Card, {
              title: "Python",
              icon: (0, import_jsx_runtime.jsx)(_components.img, {
                src: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Python-logo-notext.svg",
                alt: "Python logo"
              }),
              href: "https://github.com/fern-api/fern/tree/main/generators/python",
              children: (0, import_jsx_runtime.jsx)(_components.p, {
                children: "Pass in an image tag to use a custom icon."
              })
            })
          })
        })
      }), "\n", (0, import_jsx_runtime.jsx)(_components.h3, {
        id: "link-in-title",
        children: "Link in title"
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CardGroup, {
          children: (0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(Card, {
              title: (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, {
                children: (0, import_jsx_runtime.jsx)(_components.p, {
                  children: (0, import_jsx_runtime.jsx)(_components.a, {
                    href: "https://github.com/fern-api/fern/tree/main/generators/python",
                    children: "Python"
                  })
                })
              }),
              children: (0, import_jsx_runtime.jsx)(_components.p, {
                children: "The title text can be a link."
              })
            })
          })
        })
      }), "\n", (0, import_jsx_runtime.jsx)(_components.h3, {
        id: "icon-position",
        children: "Icon position"
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CardGroup, {
          children: (0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(Card, {
              title: "Location",
              icon: '<svg data-prefix="far" data-icon="globe" class="svg-inline--fa fa-globe" role="img" viewBox="0 0 512 512" aria-hidden="true" width="100%" height="100%"><defs><style>.fa-secondary{opacity:.4}</style></defs><path fill="currentColor" d="M303.2 413c-21.5 43.7-41.4 51-47.2 51s-25.7-7.3-47.2-51c-17-34.5-29.2-81.6-32.1-133l158.6 0c-3 51.5-15.2 98.6-32.1 133zm32.1-181l-158.6 0c3-51.5 15.2-98.6 32.1-133 21.5-43.7 41.4-51 47.2-51s25.7 7.3 47.2 51c17 34.5 29.2 81.6 32.1 133zm48.1 48l79.2 0c-8.6 74.6-56.7 137.3-122.8 166.4 24-42.8 40.3-102.4 43.6-166.4zm79.2-48l-79.2 0c-3.3-64-19.6-123.6-43.6-166.4 66.1 29.2 114.2 91.8 122.8 166.4zm-334 0l-79.2 0c8.6-74.6 56.7-137.3 122.8-166.4-24 42.8-40.3 102.4-43.6 166.4zM49.4 280l79.2 0c3.3 64 19.6 123.6 43.6 166.4-66.1-29.2-114.2-91.8-122.8-166.4zM256 512a256 256 0 1 0 0-512 256 256 0 1 0 0 512z" /></svg>',
              iconPosition: "left",
              children: (0, import_jsx_runtime.jsxs)(_components.p, {
                children: ["You can set the icon position as ", (0, import_jsx_runtime.jsx)(_components.code, {
                  children: "left"
                }), " or ", (0, import_jsx_runtime.jsx)(_components.code, {
                  children: "top"
                }), ". Default is ", (0, import_jsx_runtime.jsx)(_components.code, {
                  children: "top"
                }), "."]
              })
            })
          })
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {})]
    });
  }
  function MDXContent(props = {}) {
    const { wrapper: MDXLayout } = {
      ...useMDXComponents(),
      ...props.components
    };
    return MDXLayout ? (0, import_jsx_runtime.jsx)(MDXLayout, {
      ...props,
      children: (0, import_jsx_runtime.jsx)(_createMdxContent, {
        ...props
      })
    }) : _createMdxContent(props);
  }
  function _missingMdxReference(id, component) {
    throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
  }
  return __toCommonJS(mdx_bundler_entry_point__random_uuid__exports);
})();
;return Component;