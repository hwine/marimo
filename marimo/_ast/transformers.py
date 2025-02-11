# Copyright 2024 Marimo. All rights reserved.
from __future__ import annotations

import ast
from typing import Any


class NameTransformer(ast.NodeTransformer):
    def __init__(self, name_substitutions: dict[str, str]) -> None:
        """Remaps names in an AST.

        Naively remaps all occurrences of names in an AST, given a substitution
        dict mapping old names to new names. In particular does not take
        scoping into account.
        """
        self._name_substitutions = name_substitutions
        self.made_changes = False
        super().__init__()

    def visit_Name(self, node: ast.Name) -> ast.Name:
        self.generic_visit(node)
        if node.id in self._name_substitutions:
            self.made_changes = True
            return ast.Name(
                **{**node.__dict__, "id": self._name_substitutions[node.id]}
            )
        return node

    def visit_FunctionDef(self, node: ast.FunctionDef) -> ast.FunctionDef:
        self.generic_visit(node)
        if node.name in self._name_substitutions:
            self.made_changes = True
            return ast.FunctionDef(
                **{
                    **node.__dict__,
                    "name": self._name_substitutions[node.name],
                }
            )
        return node

    def visit_ClassDef(self, node: ast.ClassDef) -> ast.ClassDef:
        self.generic_visit(node)
        if node.name in self._name_substitutions:
            self.made_changes = True
            return ast.ClassDef(
                **{
                    **node.__dict__,
                    "name": self._name_substitutions[node.name],
                }
            )
        return node

    def visit_Assign(self, node: ast.Assign) -> ast.Assign:
        self.generic_visit(node)
        new_targets: list[Any] = []
        for target in node.targets:
            if (
                isinstance(target, ast.Name)
                and target.id in self._name_substitutions
            ):
                self.made_changes = True
                new_targets.append(
                    ast.Name(
                        id=self._name_substitutions[target.id], ctx=ast.Store()
                    )
                )
            else:
                new_targets.append(target)
        return ast.Assign(
            **{
                **node.__dict__,
                "targets": new_targets,
            }
        )
