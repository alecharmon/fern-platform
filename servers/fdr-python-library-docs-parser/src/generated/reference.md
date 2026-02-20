# Reference
<details><summary><code>client.<a href="src/fern/client.py">upload_python_library_docs_ir</a>(...)</code></summary>
<dl>
<dd>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```python
from generated import (
    AttributeIr,
    BaseClassRef,
    FernApi,
    IrMetadata,
    PythonClassIr,
    PythonFunctionIr,
    PythonModuleIr,
    PythonParameterIr,
)

client = FernApi(
    base_url="https://yourhost.com/path/to/api",
)
client.upload_python_library_docs_ir(
    metadata=IrMetadata(
        package_name="packageName",
        language="language",
    ),
    root_module=PythonModuleIr(
        name="name",
        path="path",
        classes=[
            PythonClassIr(
                name="name",
                path="path",
                kind="CLASS",
                bases=[
                    BaseClassRef(
                        name="name",
                    )
                ],
                constructor_params=[
                    PythonParameterIr(
                        name="name",
                        kind="POSITIONAL",
                    )
                ],
                methods=[
                    PythonFunctionIr(
                        name="name",
                        path="path",
                        signature="signature",
                        parameters=[
                            PythonParameterIr(
                                name="name",
                                kind="POSITIONAL",
                            )
                        ],
                        is_async=True,
                        decorators=["decorators"],
                        is_classmethod=True,
                        is_staticmethod=True,
                        is_property=True,
                    )
                ],
                attributes=[
                    AttributeIr(
                        name="name",
                        path="path",
                    )
                ],
                decorators=["decorators"],
                is_abstract=True,
                has_slots=True,
            )
        ],
        functions=[
            PythonFunctionIr(
                name="name",
                path="path",
                signature="signature",
                parameters=[
                    PythonParameterIr(
                        name="name",
                        kind="POSITIONAL",
                    )
                ],
                is_async=True,
                decorators=["decorators"],
                is_classmethod=True,
                is_staticmethod=True,
                is_property=True,
            )
        ],
        attributes=[
            AttributeIr(
                name="name",
                path="path",
            )
        ],
        submodules=[],
    ),
)

```
</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**metadata:** `IrMetadata` 
    
</dd>
</dl>

<dl>
<dd>

**root_module:** `PythonModuleIr` 
    
</dd>
</dl>

<dl>
<dd>

**request_options:** `typing.Optional[RequestOptions]` — Request-specific configuration.
    
</dd>
</dl>
</dd>
</dl>


</dd>
</dl>
</details>

