"""
code_parser.py — Parses Python source files and extracts structural metadata.

Extracts:
- Module-level functions and their signatures
- Classes and their methods
- Imports (standard library, third-party, local)
- Constants and module-level variables
"""

import ast
from dataclasses import dataclass, field


@dataclass
class FunctionInfo:
    name: str
    args: list[str]
    return_annotation: str
    docstring: str
    line_number: int
    is_method: bool
    class_name: str = ""


@dataclass
class ClassInfo:
    name: str
    base_classes: list[str]
    docstring: str
    methods: list[FunctionInfo]
    line_number: int


@dataclass
class ModuleInfo:
    file_path: str
    functions: list[FunctionInfo]
    classes: list[ClassInfo]
    imports: list[str]
    constants: list[str]
    parse_error: str = ""


def _get_arg_names(args: ast.arguments) -> list[str]:
    names = [a.arg for a in args.args]
    names += [a.arg for a in args.posonlyargs]
    names += [a.arg for a in args.kwonlyargs]
    if args.vararg:
        names.append(f"*{args.vararg.arg}")
    if args.kwarg:
        names.append(f"**{args.kwarg.arg}")
    return names


def _get_annotation(node) -> str:
    if node is None:
        return ""
    try:
        return ast.unparse(node)
    except Exception:
        return ""


def _parse_function(node: ast.FunctionDef | ast.AsyncFunctionDef, is_method: bool = False, class_name: str = "") -> FunctionInfo:
    return FunctionInfo(
        name=node.name,
        args=_get_arg_names(node.args),
        return_annotation=_get_annotation(node.returns),
        docstring=ast.get_docstring(node) or "",
        line_number=node.lineno,
        is_method=is_method,
        class_name=class_name,
    )


def parse_file(file_path: str, source_code: str) -> ModuleInfo:
    """
    Parse a Python source file and extract structural information.

    Args:
        file_path:   Path of the file (used as identifier).
        source_code: Raw Python source code string.

    Returns:
        ModuleInfo with classes, functions, imports, and constants.
    """
    try:
        tree = ast.parse(source_code, filename=file_path)
    except SyntaxError as e:
        return ModuleInfo(
            file_path=file_path,
            functions=[],
            classes=[],
            imports=[],
            constants=[],
            parse_error=str(e),
        )

    functions: list[FunctionInfo] = []
    classes: list[ClassInfo] = []
    imports: list[str] = []
    constants: list[str] = []

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            try:
                imports.append(ast.unparse(node))
            except Exception:
                pass

    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            functions.append(_parse_function(node))

        elif isinstance(node, ast.ClassDef):
            methods = []
            for item in node.body:
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    methods.append(_parse_function(item, is_method=True, class_name=node.name))
            classes.append(
                ClassInfo(
                    name=node.name,
                    base_classes=[_get_annotation(b) for b in node.bases],
                    docstring=ast.get_docstring(node) or "",
                    methods=methods,
                    line_number=node.lineno,
                )
            )

        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id.isupper():
                    try:
                        constants.append(f"{target.id} = {ast.unparse(node.value)}")
                    except Exception:
                        constants.append(target.id)

        elif isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name) and node.target.id.isupper():
                constants.append(node.target.id)

    return ModuleInfo(
        file_path=file_path,
        functions=functions,
        classes=classes,
        imports=imports,
        constants=constants,
    )


def parse_all(files: list[tuple[str, str]]) -> list[ModuleInfo]:
    """
    Parse all (file_path, source_code) pairs.

    Args:
        files: List of (file_path, source_code) tuples.

    Returns:
        List of ModuleInfo objects.
    """
    results = []
    for file_path, source_code in files:
        results.append(parse_file(file_path, source_code))
    return results


def summarize_modules(modules: list[ModuleInfo]) -> str:
    """
    Produce a human-readable text summary of all parsed modules.
    Used as input context for the AI analysis steps.
    """
    lines = []
    for mod in modules:
        if mod.parse_error:
            lines.append(f"### {mod.file_path} — PARSE ERROR: {mod.parse_error}")
            continue

        lines.append(f"### {mod.file_path}")
        if mod.classes:
            for cls in mod.classes:
                method_names = [m.name for m in cls.methods]
                lines.append(f"  class {cls.name}({', '.join(cls.base_classes)}): {method_names}")
        if mod.functions:
            lines.append(f"  functions: {[f.name for f in mod.functions]}")
        if mod.constants:
            lines.append(f"  constants: {mod.constants[:5]}")
        lines.append("")

    return "\n".join(lines)
