"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminSpecies } from "@/lib/api";
import type { Species } from "@/types/api";

export default function AdminSpeciesPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSci, setNewSci] = useState("");
  const [newFamily, setNewFamily] = useState("");

  const { data: speciesList, isLoading } = useQuery<Species[]>({
    queryKey: ["admin-species"],
    queryFn: () => adminSpecies.list() as Promise<Species[]>,
  });

  const create = useMutation({
    mutationFn: () =>
      adminSpecies.create({
        common_name: newName,
        scientific_name: newSci || null,
        family: newFamily || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-species"] });
      setNewName(""); setNewSci(""); setNewFamily(""); setAdding(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => adminSpecies.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-species"] }),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Species</h1>
        <button
          onClick={() => setAdding(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-md transition-colors"
        >
          + Add Species
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Common name *</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              autoFocus
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Scientific name</label>
            <input
              value={newSci}
              onChange={(e) => setNewSci(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Family</label>
            <input
              value={newFamily}
              onChange={(e) => setNewFamily(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>
          <button
            onClick={() => newName && create.mutate()}
            disabled={!newName || create.isPending}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded transition-colors"
          >
            Add
          </button>
          <button
            onClick={() => setAdding(false)}
            className="text-gray-500 hover:text-white text-sm px-3 py-2"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Common Name</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Scientific Name</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Family</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Photos</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {speciesList?.map((sp) => (
                <tr key={sp.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-white">{sp.common_name}</td>
                  <td className="px-4 py-3 text-gray-400 italic">{sp.scientific_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{sp.family ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-brand-400">{sp.photo_count}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${sp.common_name}"?`)) remove.mutate(sp.id);
                      }}
                      className="text-red-500 hover:text-red-400 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {speciesList?.length === 0 && (
            <p className="text-gray-500 text-center py-8">No species yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
